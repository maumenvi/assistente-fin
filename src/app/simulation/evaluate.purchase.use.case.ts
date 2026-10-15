import { z } from 'zod';
import { computeAccountBalance } from '../../domain/account/compute.account.balance.ts';
import { AccountArchivedError } from '../../domain/account/account.archived.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { CreditCardTermsNotConfiguredError } from '../../domain/credit-card/credit.card.terms.not.configured.error.ts';
import { evaluatePurchaseViability, type PendingPurchase } from '../../domain/simulation/evaluate.purchase.viability.ts';
import { type AccountProjection, type CalendarMonth } from '../../domain/simulation/account.projection.ts';
import { type PurchaseViability } from '../../domain/simulation/purchase.verdict.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type CalculateCreditCardAvailableLimitUseCase } from '../credit-card/calculate.credit.card.available.limit.use.case.ts';
import { evaluatePurchaseInputSchema } from './evaluate.purchase.input.schema.ts';

function endOfMonthUtc(month: CalendarMonth): Date {
  return new Date(Date.UTC(month.year, month.month, 0, 23, 59, 59, 999));
}

function addMonths(month: CalendarMonth, delta: number): CalendarMonth {
  const index = month.year * 12 + month.month - 1 + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Caso de uso "posso comprar?" (spec 022, FR-040..FR-043; T077). Monta, a partir dos dados do
 * usuario, o saldo previsto de cada conta no fim de cada mes do horizonte (os lancamentos
 * futuros ja materializados - parcelas, series - entram) e o limite disponivel de cada cartao,
 * junta os pre-registros pendentes e delega a regra ao dominio (`evaluatePurchaseViability`).
 *
 * Conta arquivada/inexistente -> erro pedindo outra (U1). Cartao sem fechamento/vencimento ->
 * `CreditCardTermsNotConfiguredError`: nao simula enquanto faltarem (U2).
 */
export class EvaluatePurchaseUseCase {
  private readonly database: Database;
  private readonly clock: Clock;
  private readonly availableLimit: CalculateCreditCardAvailableLimitUseCase;

  public constructor(database: Database, clock: Clock, availableLimit: CalculateCreditCardAvailableLimitUseCase) {
    this.database = database;
    this.clock = clock;
    this.availableLimit = availableLimit;
  }

  public async execute(rawInput: unknown): Promise<PurchaseViability> {
    const parsed = evaluatePurchaseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('simular compra', flat.fieldErrors, flat.formErrors);
    }
    const input = parsed.data;
    const target = await this.database.accounts.findById(input.userId, input.accountId);
    if (!target) throw new AccountNotFoundError();
    if (target.archived) throw new AccountArchivedError();
    if (target.kind === 'credit-card' && (target.creditLimit === null || target.closingDay === null || target.dueDay === null)) {
      throw new CreditCardTermsNotConfiguredError();
    }

    const now = this.clock.now();
    const when = input.date === undefined ? now : new Date(input.date);
    const purchaseMonth: CalendarMonth = { year: when.getUTCFullYear(), month: when.getUTCMonth() + 1 };
    const months = Array.from({ length: input.horizonMonths }, (_, i) => addMonths(purchaseMonth, i));

    const [accounts, transactions, pending] = await Promise.all([
      this.database.accounts.listByUser(input.userId),
      this.database.transactions.listByUser(input.userId),
      this.database.preRegistrations.listByUser(input.userId),
    ]);

    const projections: AccountProjection[] = [];
    for (const account of accounts.filter((a) => !a.archived)) {
      if (account.kind === 'credit-card') {
        // cartao sem limite/fechamento/vencimento nao entra na projecao (so e erro se for o da compra)
        if (account.creditLimit === null || account.closingDay === null || account.dueDay === null) continue;
        const available = await this.availableLimit.execute({ userId: input.userId, accountId: account.id });
        projections.push({ id: account.id, kind: 'card', baseCents: account.creditLimit.cents, availableCents: available.cents });
        continue;
      }
      projections.push({
        id: account.id,
        kind: 'account',
        baseCents: computeAccountBalance(transactions, account.id, now, account.openingBalanceDate),
        monthlyBalances: months.map((month) => ({
          ...month,
          cents: computeAccountBalance(transactions, account.id, endOfMonthUtc(month), account.openingBalanceDate),
        })),
      });
    }

    const pendingPurchases: PendingPurchase[] = pending
      .filter((pre) => pre.amount !== null)
      .map((pre) => ({
        amountCents: pre.amount?.cents ?? 0,
        accountId: pre.accountId,
        installments: pre.installments,
        month: pre.date === null ? null : { year: pre.date.getUTCFullYear(), month: pre.date.getUTCMonth() + 1 },
      }));

    return evaluatePurchaseViability({
      purchase: { amountCents: input.amountCents, accountId: input.accountId, installments: input.installments, month: purchaseMonth },
      projections,
      pending: pendingPurchases,
      safetyMargin: input.safetyMargin,
    });
  }
}
