import { Money } from '../shared/money.value.object.ts';
import { type Account } from '../account/account.entity.ts';
import { type Transaction } from './transaction.entity.ts';

/** Totais separados entre "dinheiro comum" e conta-beneficio (spec 011, RF-9..RF-12). */
export interface BenefitSplitTotals {
  readonly general: Money;
  readonly benefit: Money;
}

/** Ganhos e gastos, cada um ja separado entre `general` e `benefit`. */
export interface TransactionBenefitSummary {
  readonly income: BenefitSplitTotals;
  readonly expense: BenefitSplitTotals;
}

/**
 * Soma `transactions` em ganhos/gastos, separando o que veio de conta-beneficio do resto
 * (spec 011, RF-9..RF-12).
 *
 * Funcao pura de dominio: recebe as contas junto (para resolver `accountId -> isBenefit`) e
 * nao depende de IPC/React nem de nenhuma busca por conta propria. Cartao de credito
 * consolidado entra em `general`, a nao ser que a propria conta esteja marcada
 * `isBenefit: true` (nao ha exclusao especial por `kind`, so pela flag).
 */
export function summarizeTransactionsByAccountBenefit(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
): TransactionBenefitSummary {
  const benefitByAccountId = new Map(accounts.map((account) => [account.id, account.isBenefit]));

  let incomeGeneral = Money.zero();
  let incomeBenefit = Money.zero();
  let expenseGeneral = Money.zero();
  let expenseBenefit = Money.zero();

  for (const transaction of transactions) {
    const isBenefit = benefitByAccountId.get(transaction.accountId) ?? false;

    if (transaction.type === 'income') {
      incomeGeneral = isBenefit ? incomeGeneral : incomeGeneral.add(transaction.amount);
      incomeBenefit = isBenefit ? incomeBenefit.add(transaction.amount) : incomeBenefit;
    } else {
      expenseGeneral = isBenefit ? expenseGeneral : expenseGeneral.add(transaction.amount);
      expenseBenefit = isBenefit ? expenseBenefit.add(transaction.amount) : expenseBenefit;
    }
  }

  return {
    income: { general: incomeGeneral, benefit: incomeBenefit },
    expense: { general: expenseGeneral, benefit: expenseBenefit },
  };
}
