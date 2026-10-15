import { z } from 'zod';
import { Month } from '../../domain/shared/month.value.object.ts';
import {
  projectScenario,
  type ScenarioProjection,
} from '../../domain/scenario/project.scenario.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type IncomeRepository } from '../income/income.repository.port.ts';
import { type FixedExpenseRepository } from '../fixed-expense/fixed.expense.repository.port.ts';
import { type SpendingLimitRepository } from '../spending-limit/spending.limit.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { simulateScenarioInputSchema } from './simulate.scenario.input.schema.ts';
import { toScenarioAdjustment } from './to.scenario.adjustment.ts';

/**
 * Caso de uso "simular cenario" / "Simulacao geral" (spec 002, RF-33).
 *
 * So leitura: carrega o estado atual do usuario (ganhos/gastos/limites/transacoes), monta os
 * `ScenarioAdjustment` e chama `projectScenario` (dominio puro) do mes atual ate
 * `horizonMonths` a frente. Nada e persistido. Nao exige verificacao (e uma previa).
 */
export class SimulateScenarioUseCase {
  private readonly users: UserRepository;
  private readonly incomes: IncomeRepository;
  private readonly fixedExpenses: FixedExpenseRepository;
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly transactions: TransactionRepository;
  private readonly clock: Clock;

  public constructor(
    users: UserRepository,
    incomes: IncomeRepository,
    fixedExpenses: FixedExpenseRepository,
    spendingLimits: SpendingLimitRepository,
    transactions: TransactionRepository,
    clock: Clock,
  ) {
    this.users = users;
    this.incomes = incomes;
    this.fixedExpenses = fixedExpenses;
    this.spendingLimits = spendingLimits;
    this.transactions = transactions;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<ScenarioProjection> {
    const parsed = simulateScenarioInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('simular cenario', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const [incomes, fixedExpenses, spendingLimits, allTransactions] = await Promise.all([
      this.incomes.listByUser(input.userId),
      this.fixedExpenses.listByUser(input.userId),
      this.spendingLimits.listByUser(input.userId),
      this.transactions.listByUser(input.userId),
    ]);

    return projectScenario({
      baseInputs: {
        incomes,
        fixedExpenses,
        spendingLimits,
        historicalExpenses: allTransactions.filter((transaction) => transaction.type === 'expense'),
      },
      adjustments: input.adjustments.map(toScenarioAdjustment),
      months: horizonMonths(Month.fromDate(this.clock.now()), input.horizonMonths),
    });
  }
}

/** `count` meses a partir de `start` (inclusive), em ordem. */
function horizonMonths(start: Month, count: number): Month[] {
  const months: Month[] = [];
  let cursor = start;
  for (let i = 0; i < count; i += 1) {
    months.push(cursor);
    cursor = cursor.next();
  }
  return months;
}
