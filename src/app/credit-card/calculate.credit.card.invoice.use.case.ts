import { z } from 'zod';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { assertCreditCardAccount } from '../../domain/credit-card/assert.credit.card.account.ts';
import { CreditCardTermsNotConfiguredError } from '../../domain/credit-card/credit.card.terms.not.configured.error.ts';
import { nextCreditCardBillingCycle } from '../../domain/credit-card/next.credit.card.billing.cycle.ts';
import { calculateCreditCardBillingPeriod } from '../../domain/credit-card/credit.card.billing.period.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { calculateCreditCardInvoiceInputSchema } from './calculate.credit.card.invoice.input.schema.ts';

/** Resultado do calculo da fatura projetada para o proximo vencimento (spec 008, RF-9). */
export interface CreditCardInvoice {
  readonly dueDate: Date;
  /** Data de fechamento do ciclo correspondente a `dueDate` (spec 008 revisao, RF-9, CA-7). */
  readonly closingDate: Date;
  /** Inicio do periodo de apuracao deste ciclo (dia seguinte ao fechamento anterior). */
  readonly openingDate: Date;
  readonly amount: Money;
  readonly transactionCount: number;
}

/**
 * Caso de uso "calcular fatura de cartao de credito" (spec 008 revisao, RF-5, RF-5a, RF-9,
 * CA-7).
 *
 * Sem `month` na entrada: calcula a fatura do proximo vencimento a partir de `Clock.now()`
 * - acha o ciclo de fechamento/vencimento (independentes, `nextCreditCardBillingCycle`) mais
 * proximo. Com `month` (spec 011, decisao 4.3): calcula o ciclo cujo vencimento cai naquele
 * mes especifico, passado ou futuro (RF-6), reaproveitando `calculateCreditCardBillingPeriod`
 * - mesma logica de `resolveCreditCardInvoicesForMonth`. Em ambos os casos soma as despesas
 * da conta no periodo de apuracao correspondente. Nao persiste nada (decisao 4.2 do plano -
 * sempre recalculado sob demanda).
 */
export class CalculateCreditCardInvoiceUseCase {
  private readonly accounts: AccountRepository;
  private readonly transactions: TransactionRepository;
  private readonly clock: Clock;

  public constructor(accounts: AccountRepository, transactions: TransactionRepository, clock: Clock) {
    this.accounts = accounts;
    this.transactions = transactions;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<CreditCardInvoice> {
    const parsed = calculateCreditCardInvoiceInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('calcular fatura de cartao de credito', flat.fieldErrors, flat.formErrors);
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

    const period =
      input.month !== undefined
        ? calculateCreditCardBillingPeriod(
            account.closingDay,
            account.dueDay,
            account.dueDay > account.closingDay
              ? Month.create(input.month)
              : Month.create(input.month).previous(),
          )
        : nextCreditCardBillingCycle(account.closingDay, account.dueDay, this.clock.now());

    const expenses = await this.transactions.listExpensesByAccountAndDateRange(
      input.userId,
      input.accountId,
      period.from,
      period.to,
    );

    const amount = expenses.reduce((total, transaction) => total.add(transaction.amount), Money.zero());

    return {
      dueDate: period.dueDate,
      closingDate: period.to,
      openingDate: period.from,
      amount,
      transactionCount: expenses.length,
    };
  }
}
