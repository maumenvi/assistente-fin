import { computeAccountBalance } from '../../../../src/app/dashboard/compute.view.account.balance.ts';
import { summarizeDashboardMonth } from '../../../../src/app/dashboard/summarize.dashboard.month.ts';
import { usagePercent } from '../../../../src/app/spending-limit/usage.percent.ts';
import { toDashboardTransaction } from '../../../../src/app/agent/tools/shared/to.dashboard.transaction.ts';
import { formatBrl } from '../../../../src/app/agent/verify/format.brl.ts';
import { type EvalDataset } from './eval.dataset.ts';

/** Primeiro e ultimo dia de um mes "AAAA-MM". */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * GABARITO da avaliacao: cada funcao calcula o numero direto dos casos de uso e das regras do app
 * (nunca pelas ferramentas do agente), para a resposta do modelo ser conferida contra a fonte.
 */
export async function expenseTotal(ds: EvalDataset, filter: { category?: string; month?: string; from?: string; to?: string }): Promise<number> {
  const range = filter.month === undefined ? { from: filter.from ?? '0000-01-01', to: filter.to ?? '9999-12-31' } : monthRange(filter.month);
  const rows = await ds.container.listTransactions.execute({ userId: ds.userId });
  return rows
    .filter(({ item, categoryName }) => {
      const day = item.date.toISOString().slice(0, 10);
      return item.type === 'expense' && day >= range.from && day <= range.to && (filter.category === undefined || categoryName === filter.category.toUpperCase());
    })
    .reduce((sum, { item }) => sum + item.amount.cents, 0);
}

export async function incomeTotal(ds: EvalDataset, month: string): Promise<number> {
  const range = monthRange(month);
  const rows = await ds.container.listTransactions.execute({ userId: ds.userId });
  return rows.filter(({ item }) => item.type === 'income' && item.date.toISOString().slice(0, 10) >= range.from && item.date.toISOString().slice(0, 10) <= range.to).reduce((s, { item }) => s + item.amount.cents, 0);
}

/** Saldo de uma conta de saldo, pela mesma regra do Dashboard, hoje (15/10/2026). */
export async function accountBalance(ds: EvalDataset, accountId: string): Promise<number> {
  const [accounts, rows] = await Promise.all([ds.container.listAccounts.execute({ userId: ds.userId }), ds.container.listTransactions.execute({ userId: ds.userId })]);
  const account = accounts.find((a) => a.id === accountId);
  if (account === undefined) throw new Error(`conta ${accountId} nao existe na base de avaliacao`);
  return computeAccountBalance(rows.map(toDashboardTransaction), accountId, ds.clock.now(), account.openingBalanceDate);
}

export async function totalBalance(ds: EvalDataset): Promise<number> {
  const accounts = await ds.container.listAccounts.execute({ userId: ds.userId });
  let total = 0;
  for (const a of accounts.filter((x) => x.kind !== 'credit-card')) total += await accountBalance(ds, a.id);
  return total;
}

/** Limite de uma categoria em outubro/2026: limite, usado, restante e % usado. */
export async function limitStatus(ds: EvalDataset, categoryId: string): Promise<{ max: number; spent: number; remaining: number; percent: number }> {
  const usages = await ds.container.listSpendingLimitsWithUsage.execute({ userId: ds.userId });
  const usage = usages.find((u) => u.limit.categoryId === categoryId && u.limit.period.year === 2026 && u.limit.period.month === 10);
  if (usage === undefined) throw new Error(`sem limite para ${categoryId}`);
  return { max: usage.limit.maxAmount.cents, spent: usage.spent.cents, remaining: usage.limit.maxAmount.cents - usage.spent.cents, percent: usagePercent(usage.spent.cents, usage.limit.maxAmount.cents) };
}

export async function monthSummary(ds: EvalDataset, month: string): Promise<{ income: number; expense: number; balance: number }> {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const [accounts, rows, fixed] = await Promise.all([
    ds.container.listAccounts.execute({ userId: ds.userId }),
    ds.container.listTransactions.execute({ userId: ds.userId }),
    ds.container.listFixedExpenses.execute({ userId: ds.userId }),
  ]);
  const summary = summarizeDashboardMonth(
    rows.map(toDashboardTransaction),
    accounts.map((a) => ({ id: a.id, kind: a.kind, isBenefit: a.isBenefit, openingBalanceDate: a.openingBalanceDate?.toISOString() ?? null })),
    fixed.map(({ item, categoryName }) => ({ categoryId: item.categoryId, categoryName, expectedAmountCents: item.expectedAmount.cents })),
    { year, month: m },
  );
  return { income: summary.totalIncomeCents, expense: summary.totalExpenseCents, balance: summary.balanceCents };
}

export async function forecastBalance(ds: EvalDataset, month: string): Promise<number> {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return (await ds.container.getMonthlyForecast.execute({ userId: ds.userId, month: { year, month: m } })).projectedBalance.cents;
}

export async function cardStatus(ds: EvalDataset, accountId: string): Promise<{ invoice: number; available: number; committed: number }> {
  const input = { userId: ds.userId, accountId };
  const [invoice, available, committed] = await Promise.all([
    ds.container.calculateCreditCardInvoice.execute(input),
    ds.container.calculateCreditCardAvailableLimit.execute(input),
    ds.container.calculateCreditCardCommittedBalance.execute(input),
  ]);
  return { invoice: invoice.amount.cents, available: available.cents, committed: committed.amount.cents };
}

export async function fixedExpensesTotal(ds: EvalDataset): Promise<number> {
  return (await ds.container.listFixedExpenses.execute({ userId: ds.userId })).reduce((s, { item }) => s + item.expectedAmount.cents, 0);
}

export async function visibleCategoryCount(ds: EvalDataset): Promise<number> {
  return (await ds.container.listCategories.execute({ userId: ds.userId })).filter((c) => !c.isSystemBalance && !c.isSystemOpeningBalance && !c.isSystemAdjustment && !c.isSystemTransfer && !c.isSystemCardPayment).length;
}

/** Contagem e soma exatas dos lancamentos em "SEM CATEGORIA" (spec 037, T002). */
export async function uncategorizedStats(ds: EvalDataset): Promise<{ count: number; totalCents: number }> {
  const rows = await ds.container.listTransactions.execute({ userId: ds.userId });
  const pending = rows.filter(({ categoryName }) => categoryName === 'SEM CATEGORIA');
  return { count: pending.length, totalCents: pending.reduce((sum, { item }) => sum + item.amount.cents, 0) };
}

export const brl = formatBrl;
