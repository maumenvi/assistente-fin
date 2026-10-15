import { Money } from '../../domain/shared/money.value.object.ts';
import { type Month } from '../../domain/shared/month.value.object.ts';
import { type Account } from '../../domain/account/account.entity.ts';
import { calculateCreditCardBillingPeriod } from '../../domain/credit-card/credit.card.billing.period.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';

/**
 * Calcula, para cada conta `credit-card` com `closingDay`/`dueDay` configurados cujo
 * vencimento cai em `month`, o valor da fatura desse periodo (spec 008 revisao, RF-6) -
 * usado pelos orquestradores de previsao (`GetMonthlyForecastUseCase`,
 * `GetForecastRangeUseCase`) para montar `ForecastInputs.creditCardInvoices`.
 *
 * `month` e o mes de vencimento (RF-6 fala do mes em que a fatura vence, nao do mes do
 * fechamento); o mes de fechamento correspondente depende da relacao entre `dueDay` e
 * `closingDay` (mesma comparacao de `calculateCreditCardBillingPeriod`): fechamento no
 * proprio `month` se `dueDay > closingDay`, no mes anterior senao.
 *
 * Contas `credit-card` sem `closingDay`/`dueDay` configurados sao ignoradas (nao entram na
 * previsao) - mesma decisao 4.4 do plano aplicada aqui: sem termos, nao ha fatura
 * calculavel.
 */
export async function resolveCreditCardInvoicesForMonth(
  userId: string,
  accounts: readonly Account[],
  transactions: TransactionRepository,
  month: Month,
): Promise<Money[]> {
  const creditCards = accounts.filter(
    (account) => account.kind === 'credit-card' && account.closingDay !== null && account.dueDay !== null,
  );

  return Promise.all(
    creditCards.map(async (account) => {
      const closingDay = account.closingDay as number;
      const dueDay = account.dueDay as number;
      const closingMonth = dueDay > closingDay ? month : month.previous();
      const period = calculateCreditCardBillingPeriod(closingDay, dueDay, closingMonth);
      const expenses = await transactions.listExpensesByAccountAndDateRange(
        userId,
        account.id,
        period.from,
        period.to,
      );
      return expenses.reduce((total, transaction) => total.add(transaction.amount), Money.zero());
    }),
  );
}
