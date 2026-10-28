import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { countFact } from './shared/count.fact.ts';
import { incomeAppliesToMonth } from './shared/income.applies.to.month.ts';
import { monthArgSchema, monthKey, monthLabel, monthOf, parseMonthArg } from './shared/month.arg.ts';
import { moneyFact } from './shared/money.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const inputSchema = z.object({
  month: monthArgSchema.optional().describe('Mes (AAAA-MM); omita para o mes atual.'),
});

type Args = z.infer<typeof inputSchema>;

/**
 * `list_incomes` (spec 031, T063): ganhos cadastrados que valem para o mes (mesma regra da tela
 * Ganhos), ate 10 itens, com o total mensal e a quantidade como fatos e se o mes ja foi lancado
 * no Extrato. Somente leitura.
 */
export function listIncomesTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'list_incomes',
    description: 'Ganhos (salario, rendas) cadastrados que valem para um mes, com total mensal e se ja foram lancados. Use para "quanto vou receber em tal mes".',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const month = args.month === undefined ? monthOf(ctx.now) : parseMonthArg(args.month);
      const key = monthKey(month);
      const listed = await deps.listIncomes.execute({ userId: ctx.userId });
      const rows = listed
        .filter(({ item }) => incomeAppliesToMonth(item, month))
        .sort((a, b) => b.item.amount.cents - a.item.amount.cents || a.item.id.localeCompare(b.item.id));
      const totalCents = rows.reduce((sum, { item }) => sum + item.amount.cents, 0);
      const shown = rows.slice(0, ctx.limits.maxItems);
      const facts: Fact[] = [
        moneyFact('total', `total de ganhos de ${monthLabel(month)}`, totalCents),
        countFact('quantidade', 'quantidade de ganhos', rows.length),
        ...shown.map(({ item }) => moneyFact(`ganho.${item.id}`, `valor de ${sanitizeText(item.source, 40)}`, item.amount.cents)),
      ];
      const lines = shown.map(
        ({ item, categoryName, launchedMonths }) =>
          `- ${sanitizeText(item.source, 60)}: ${formatBrl(item.amount.cents)} (${sanitizeText(categoryName, 40)}${item.recurrence.frequency === 'nao-repete' ? '' : `, ${item.recurrence.frequency}`}${launchedMonths.includes(key) ? ', ja lancado' : ', nao lancado'}) [id ${item.id}]`,
      );
      return buildToolResult({
        tool: 'list_incomes',
        body: rows.length === 0 ? `Nenhum ganho para ${monthLabel(month)}.` : `Total: ${formatBrl(totalCents)} em ${rows.length} ganhos\n${lines.join('\n')}`,
        facts,
        summary: { tool: 'list_incomes', label: `ganhos de ${monthLabel(month)}`, filters: { mes: key }, itemCount: rows.length, truncated: rows.length > shown.length },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
