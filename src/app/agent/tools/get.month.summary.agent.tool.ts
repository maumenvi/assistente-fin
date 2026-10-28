import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { summarizeDashboardMonth } from '../../dashboard/summarize.dashboard.month.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { getSpendingLimitsTool } from './get.spending.limits.agent.tool.ts';
import { queryTransactionsTool } from './query.transactions.agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { monthArgSchema, monthKey, monthLabel, parseMonthArg } from './shared/month.arg.ts';
import { monthBounds } from './shared/month.bounds.ts';
import { moneyFact } from './shared/money.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';
import { toDashboardTransaction } from './shared/to.dashboard.transaction.ts';
import { unwrapDados } from './shared/unwrap.dados.ts';

const inputSchema = z.object({ month: monthArgSchema });

type Args = z.infer<typeof inputSchema>;

/** Quantas categorias de gasto entram no resumo. */
const TOP_CATEGORIES = 5;

/**
 * `get_month_summary` (spec 031, T065): visao do mes. Receitas, despesas (incluindo gastos fixos)
 * e resultado vem da MESMA conta do Inicio (`summarizeDashboardMonth`); o total do Extrato e os
 * limites reusam `query_transactions` e `get_spending_limits` - nenhuma regra e reimplementada.
 * Somente leitura.
 */
export function getMonthSummaryTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'get_month_summary',
    description:
      'Resumo de um mes: receitas, despesas (com gastos fixos), resultado, principais categorias de gasto, total do Extrato e situacao dos limites. Use para "como foi meu mes" ou visao geral.',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx, signal) {
      const month = parseMonthArg(args.month);
      const key = monthKey(month);
      const [accounts, listed, fixed] = await Promise.all([
        deps.listAccounts.execute({ userId: ctx.userId }),
        deps.listTransactions.execute({ userId: ctx.userId }),
        deps.listFixedExpenses.execute({ userId: ctx.userId }),
      ]);
      const summary = summarizeDashboardMonth(
        listed.map(toDashboardTransaction),
        accounts.map((account) => ({
          id: account.id,
          kind: account.kind,
          isBenefit: account.isBenefit,
          openingBalanceDate: account.openingBalanceDate?.toISOString() ?? null,
        })),
        fixed.map(({ item, categoryName }) => ({ categoryId: item.categoryId, categoryName, expectedAmountCents: item.expectedAmount.cents })),
        month,
      );
      const extrato = await queryTransactionsTool(deps).run(monthBounds(month), ctx, signal);
      const limits = await getSpendingLimitsTool(deps).run({ month: key }, ctx, signal);
      const topExpenses = summary.expenseByCategory.slice(0, TOP_CATEGORIES);

      const facts: Fact[] = [
        moneyFact('receitas', `receitas de ${monthLabel(month)}`, summary.totalIncomeCents),
        moneyFact('despesas', `despesas de ${monthLabel(month)} (com gastos fixos)`, summary.totalExpenseCents),
        moneyFact('resultado', `resultado de ${monthLabel(month)} (receitas - despesas)`, summary.balanceCents),
        ...topExpenses.map((row) => moneyFact(`despesa.${row.categoryId}`, `despesa em ${sanitizeText(row.categoryName, 40)}`, row.totalCents)),
        ...extrato.facts.map((fact) => ({ ...fact, id: `extrato.${fact.id}` })),
        ...limits.facts.map((fact) => ({ ...fact, id: `limites.${fact.id}` })),
      ];
      const lines = [
        `Mes: ${monthLabel(month)}`,
        `Receitas: ${formatBrl(summary.totalIncomeCents)}`,
        `Despesas (inclui gastos fixos): ${formatBrl(summary.totalExpenseCents)}`,
        `Resultado: ${formatBrl(summary.balanceCents)}`,
      ];
      if (topExpenses.length > 0) {
        lines.push('Maiores despesas por categoria:');
        for (const row of topExpenses) lines.push(`- ${sanitizeText(row.categoryName, 40)}: ${formatBrl(row.totalCents)}`);
      }
      lines.push('Extrato do mes (lancamentos):', unwrapDados(extrato.contentForModel), 'Limites de gasto:', unwrapDados(limits.contentForModel));
      return buildToolResult({
        tool: 'get_month_summary',
        body: lines.join('\n'),
        facts,
        summary: { tool: 'get_month_summary', label: `resumo de ${monthLabel(month)}`, filters: { mes: key }, itemCount: extrato.summary.itemCount, truncated: false },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
