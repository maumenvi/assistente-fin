import { z } from 'zod';
import { Money } from '../../domain/shared/money.value.object.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { assertCreditCardAccount } from '../../domain/credit-card/assert.credit.card.account.ts';
import { CreditCardTermsNotConfiguredError } from '../../domain/credit-card/credit.card.terms.not.configured.error.ts';
import { currentCreditCardOpenPeriodStart } from '../../domain/credit-card/current.credit.card.open.period.start.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { calculateCreditCardAvailableLimitInputSchema } from './calculate.credit.card.available.limit.input.schema.ts';

/** Data usada como limite superior "sem fim" ao buscar despesas em aberto (RF-7). */
const FAR_FUTURE_DATE = new Date('9999-12-31T00:00:00.000Z');

/**
 * Caso de uso "calcular limite disponivel de cartao de credito" (spec 008, RF-7, RF-8, CA-5,
 * CA-6).
 *
 * `creditLimit - soma das despesas ja lancadas que ainda nao venceram (faturas em aberto)`.
 * Pode dar negativo (estouro de limite, CA-6) - o caso de uso nao impede a consulta, so
 * calcula e devolve o valor (mesmo que negativo).
 *
 * Spec 014, RF-2: esse resultado e exatamente `creditLimit - (fatura do ciclo aberto + saldo
 * comprometido)`, sem contar nada duas vezes - `CalculateCreditCardCommittedBalanceUseCase`
 * decompoe a soma de despesas em aberto (calculada aqui sem teto de data) em "fatura do ciclo
 * aberto" vs. "parcelas futuras comprometidas", so para fins de exibicao (RF-8); o total
 * calculado por esta classe nao muda.
 */
export class CalculateCreditCardAvailableLimitUseCase {
  private readonly accounts: AccountRepository;
  private readonly transactions: TransactionRepository;
  private readonly clock: Clock;

  public constructor(accounts: AccountRepository, transactions: TransactionRepository, clock: Clock) {
    this.accounts = accounts;
    this.transactions = transactions;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<Money> {
    const parsed = calculateCreditCardAvailableLimitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError(
        'calcular limite disponivel de cartao de credito',
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

    const openPeriodStart = currentCreditCardOpenPeriodStart(
      account.closingDay,
      account.dueDay,
      this.clock.now(),
    );
    const openExpenses = await this.transactions.listExpensesByAccountAndDateRange(
      input.userId,
      input.accountId,
      openPeriodStart,
      FAR_FUTURE_DATE,
    );
    const openAmount = openExpenses.reduce(
      (total, transaction) => total.add(transaction.amount),
      Money.zero(),
    );

    return account.creditLimit.subtract(openAmount);
  }
}
