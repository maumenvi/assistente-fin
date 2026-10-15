import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { addUtcMonths } from '../../domain/shared/add.utc.months.ts';
import { buildInstallmentPlan } from '../../domain/money/split.evenly.ts';
import { FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { type PurchaseSimulation } from '../../domain/simulation/simulation.entity.ts';
import { SimulationNotFoundError } from '../../domain/simulation/simulation.not.found.error.ts';
import { SimulationNotRecurringError } from '../../domain/simulation/simulation.not.recurring.error.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { approveSimulationInputSchema } from './approve.simulation.input.schema.ts';

/** Resultado de `ApproveSimulationUseCase` - discriminado por `as` (RF-11). */
export type ApproveSimulationResult =
  | { readonly as: 'real'; readonly simulation: PurchaseSimulation; readonly transactions: readonly Transaction[] }
  | { readonly as: 'planned'; readonly simulation: PurchaseSimulation; readonly fixedExpense: FixedExpense };

/**
 * Caso de uso "aprovar simulacao" (spec 001, RF-11, plan.md decisao 13).
 *
 * Exige usuario verificado (`UserNotVerifiedError` - RF-28): diferente de `SimulatePurchase`,
 * aqui a compra vira dado financeiro de verdade, mesma categoria de `RecordTransaction`/
 * `RegisterFixedExpense` (decisao 9 do plano). `SimulationNotFoundError` se a simulacao nao
 * existir no escopo do usuario (RF-16, CA-14); `simulation.approve(now)` ja lanca
 * `SimulationAlreadyApprovedError` se reaprovada.
 *
 * - `as: 'real'`: cria a(s) `Transaction`(s) (`type: 'expense'`, na data da compra) -
 *   recorrencia da simulacao foi so pra previa (RF-10), a transacao real e um lancamento
 *   unico "aconteceu agora"; mas parcelamento (`installments > 1`) e propagado pra aprovacao
 *   real, na mesma logica de `RecordInstallmentPurchaseUseCase` (`buildInstallmentPlan` +
 *   `addUtcMonths`, um mes por parcela) - senao a previa mostraria "Nx de R$Y" e a aprovacao
 *   viraria 1 lancamento do valor cheio, incoerente com o que foi simulado.
 * - `as: 'planned'`: so permitido se a simulacao e recorrente (`SimulationNotRecurringError`
 *   senao); cria um `FixedExpense` com aquela recorrencia (`dueDay` derivado do dia da data
 *   da compra).
 *
 * Tudo dentro de `Database.transaction()` - marcar aprovada e criar o registro sao atomicos.
 */
export class ApproveSimulationUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<ApproveSimulationResult> {
    const parsed = approveSimulationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('aprovar simulacao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const simulation = await this.database.simulations.findById(input.userId, input.simulationId);
    if (!simulation) {
      throw new SimulationNotFoundError();
    }

    if (input.as === 'planned' && !simulation.isRecurring()) {
      throw new SimulationNotRecurringError();
    }

    const approved = simulation.approve(this.clock.now());

    return this.database.transaction(async (tx): Promise<ApproveSimulationResult> => {
      await tx.simulations.save(approved);

      if (input.as === 'real') {
        if (approved.installments === 1) {
          const transaction = Transaction.create({
            id: this.ids.next(),
            userId: approved.userId,
            date: approved.date,
            amount: approved.amount,
            type: 'expense',
            categoryId: approved.categoryId,
            accountId: approved.accountId,
          });
          await tx.transactions.save(transaction);
          return { as: 'real', simulation: approved, transactions: [transaction] };
        }

        const plan = buildInstallmentPlan(approved.amount.cents, approved.installments);
        const installmentGroupId = this.ids.next();
        const transactions: Transaction[] = [];
        for (let index = 0; index < plan.length; index += 1) {
          const transaction = Transaction.create({
            id: this.ids.next(),
            userId: approved.userId,
            date: addUtcMonths(approved.date, index),
            amount: Money.fromCents(plan[index]!),
            type: 'expense',
            categoryId: approved.categoryId,
            accountId: approved.accountId,
            installmentGroupId,
            installmentNumber: index + 1,
            installmentTotal: plan.length,
          });
          await tx.transactions.save(transaction);
          transactions.push(transaction);
        }
        return { as: 'real', simulation: approved, transactions };
      }

      const fixedExpense = FixedExpense.create({
        id: this.ids.next(),
        userId: approved.userId,
        dueDay: approved.date.getUTCDate(),
        expectedAmount: approved.amount,
        categoryId: approved.categoryId,
        accountId: approved.accountId,
      });
      await tx.fixedExpenses.save(fixedExpense);
      return { as: 'planned', simulation: approved, fixedExpense };
    });
  }
}
