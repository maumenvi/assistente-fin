import { z } from 'zod';
import { Money } from '../../domain/shared/money.value.object.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { assertCreditCardAccount } from '../../domain/credit-card/assert.credit.card.account.ts';
import { CreditCardTermsNotConfiguredError } from '../../domain/credit-card/credit.card.terms.not.configured.error.ts';
import { nextCreditCardBillingCycle } from '../../domain/credit-card/next.credit.card.billing.cycle.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { calculateCreditCardCommittedBalanceInputSchema } from './calculate.credit.card.committed.balance.input.schema.ts';

/** Data usada como limite superior "sem fim" ao buscar parcelas futuras (mesmo padrao de RF-7 da spec 008). */
const FAR_FUTURE_DATE = new Date('9999-12-31T00:00:00.000Z');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Resultado do calculo de saldo comprometido (spec 014, RF-1, RF-8). */
export interface CreditCardCommittedBalance {
  readonly amount: Money;
  readonly transactionCount: number;
}

/**
 * Caso de uso "calcular saldo comprometido de cartao de credito" (spec 014, RF-1, RF-2, RF-4,
 * RF-8, RF-9).
 *
 * Soma o valor de todas as parcelas (`Transaction.isInstallment()`) de compras parceladas
 * (spec 009) cuja data e posterior ao fim do ciclo de fatura em aberto (`openPeriod.to`) -
 * independentemente de a compra ter sido feita no ciclo atual ou em um anterior (RF-1). O
 * corte e `openPeriod.to`, nao "hoje" (decisao 4.b/4.c do plano): tudo em
 * `[openPeriod.from, openPeriod.to]` ja e contado como fatura do ciclo aberto
 * (`CalculateCreditCardInvoiceUseCase`/`CalculateCreditCardAvailableLimitUseCase`); o saldo
 * comprometido soma so o que vem estritamente depois, garantindo por construcao que nenhuma
 * parcela e contada duas vezes (RF-2). Despesas comuns (nao-parcela) datadas no futuro nao
 * entram (RF-1 e restrito a parcelas).
 */
export class CalculateCreditCardCommittedBalanceUseCase {
  private readonly accounts: AccountRepository;
  private readonly transactions: TransactionRepository;
  private readonly clock: Clock;

  public constructor(accounts: AccountRepository, transactions: TransactionRepository, clock: Clock) {
    this.accounts = accounts;
    this.transactions = transactions;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<CreditCardCommittedBalance> {
    const parsed = calculateCreditCardCommittedBalanceInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError(
        'calcular saldo comprometido de cartao de credito',
        flat.fieldErrors,
        flat.formErrors,
      );
    }

    const input = parsed.data;
    const account = await this.accounts.findById(input.userId, input.accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }
    assertCreditCardAccount(account);
    if (account.creditLimit === null || account.closingDay === null || account.dueDay === null) {
      throw new CreditCardTermsNotConfiguredError();
    }

    const openPeriod = nextCreditCardBillingCycle(account.closingDay, account.dueDay, this.clock.now());
    const committedRangeStart = new Date(openPeriod.to.getTime() + ONE_DAY_MS);

    const futureExpenses = await this.transactions.listExpensesByAccountAndDateRange(
      input.userId,
      input.accountId,
      committedRangeStart,
      FAR_FUTURE_DATE,
    );
    const installments = futureExpenses.filter((transaction) => transaction.isInstallment());
    const amount = installments.reduce((total, transaction) => total.add(transaction.amount), Money.zero());

    return { amount, transactionCount: installments.length };
  }
}
