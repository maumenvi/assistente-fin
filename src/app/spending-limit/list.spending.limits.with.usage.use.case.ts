import { z } from 'zod';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { type SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import {
  calculateLimitStatus,
  type LimitStatus,
} from '../../domain/spending-limit/limit.status.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { listSpendingLimitInputSchema } from './list.spending.limit.input.schema.ts';

/** Um limite + o quanto ja foi gasto na categoria/mes dele + o status resultante (CA-4). */
export interface SpendingLimitUsage {
  readonly limit: SpendingLimit;
  readonly spent: Money;
  readonly status: LimitStatus;
}

/**
 * Caso de uso "listar limites com uso" (spec 001, RF-4, RF-19, CA-4).
 *
 * Para cada limite, soma as transacoes de gasto (`type: 'expense'`) da MESMA categoria no
 * MESMO mes de competencia e deriva o status via `calculateLimitStatus` (dominio). Gastos em
 * conta-beneficio nao entram no "usado" de nenhum limite (spec 011, RF-11) - mesmo principio
 * da funcao central de agregacao, aplicado na granularidade de categoria. So leitura - nao
 * exige usuario verificado.
 */
export class ListSpendingLimitsWithUsageUseCase {
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly transactions: TransactionRepository;
  private readonly accounts: AccountRepository;

  public constructor(
    spendingLimits: SpendingLimitRepository,
    transactions: TransactionRepository,
    accounts: AccountRepository,
  ) {
    this.spendingLimits = spendingLimits;
    this.transactions = transactions;
    this.accounts = accounts;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimitUsage[]> {
    const parsed = listSpendingLimitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar limites de gasto', flat.fieldErrors, flat.formErrors);
    }

    const { userId } = parsed.data;
    const [limits, allTransactions, allAccounts] = await Promise.all([
      this.spendingLimits.listByUser(userId),
      this.transactions.listByUser(userId),
      this.accounts.listByUser(userId),
    ]);
    const benefitAccountIds = new Set(
      allAccounts.filter((account) => account.isBenefit).map((account) => account.id),
    );

    return limits.map((limit) => {
      const spent = allTransactions
        .filter(
          (transaction) =>
            transaction.type === 'expense' &&
            // casa por id: renomear a categoria nao desfaz o vinculo limite <-> gasto (CA-24)
            transaction.categoryId === limit.categoryId &&
            Month.fromDate(transaction.date).equals(limit.period) &&
            !benefitAccountIds.has(transaction.accountId),
        )
        .reduce((sum, transaction) => sum.add(transaction.amount), Money.zero());

      return { limit, spent, status: calculateLimitStatus(limit.maxAmount, spent) };
    });
  }
}
