import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { usagePercent } from '../../spending-limit/usage.percent.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { monthArgSchema, monthLabel, monthOf, parseMonthArg } from './shared/month.arg.ts';
import { moneyFact } from './shared/money.fact.ts';
import { percentFact } from './shared/percent.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const inputSchema = z.object({
  month: monthArgSchema.optional().describe('Mes dos limites (AAAA-MM); omita para o mes atual.'),
});

type Args = z.infer<typeof inputSchema>;

const STATUS_TEXT = { ok: 'dentro do limite', 'at-risk': 'perto do limite', exceeded: 'limite ultrapassado' } as const;

/**
 * `get_spending_limits` (spec 031, T060): limites de gasto por categoria no mes, quanto ja foi
 * usado, o restante e o percentual - calculados AQUI (o modelo so cita), com o mesmo calculo da
 * tela de limites. Somente leitura.
 */
export function getSpendingLimitsTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'get_spending_limits',
    description:
      'Limites de gasto por categoria em um mes: valor do limite, quanto ja foi usado, quanto resta e o percentual usado. Use para "como estao meus limites" ou "ainda posso gastar com X".',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const month = args.month === undefined ? monthOf(ctx.now) : parseMonthArg(args.month);
      const [usages, categories] = await Promise.all([
        deps.listSpendingLimitsWithUsage.execute({ userId: ctx.userId }),
        deps.listCategories.execute({ userId: ctx.userId }),
      ]);
      const names = new Map(categories.map((category) => [category.id, category.name.value]));
      const rows = usages
        .filter((usage) => usage.limit.period.year === month.year && usage.limit.period.month === month.month)
        .map((usage) => ({
          id: usage.limit.id,
          name: sanitizeText(names.get(usage.limit.categoryId) ?? 'sem categoria', 40),
          maxCents: usage.limit.maxAmount.cents,
          spentCents: usage.spent.cents,
          status: usage.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const shown = rows.slice(0, ctx.limits.maxItems);
      const facts: Fact[] = [];
      const lines: string[] = [];
      for (const row of shown) {
        const remaining = row.maxCents - row.spentCents;
        const percent = usagePercent(row.spentCents, row.maxCents);
        facts.push(
          moneyFact(`limite.${row.id}`, `limite de ${row.name}`, row.maxCents),
          moneyFact(`usado.${row.id}`, `usado em ${row.name}`, row.spentCents),
          moneyFact(`restante.${row.id}`, `restante em ${row.name}`, remaining),
          percentFact(`percentual.${row.id}`, `percentual usado em ${row.name}`, percent),
        );
        const rest = remaining >= 0 ? `restam ${formatBrl(remaining)}` : `ultrapassou em ${formatBrl(-remaining)}`;
        lines.push(`- ${row.name}: limite ${formatBrl(row.maxCents)}; usado ${formatBrl(row.spentCents)} (${percent}%); ${rest}; ${STATUS_TEXT[row.status]}.`);
      }
      return buildToolResult({
        tool: 'get_spending_limits',
        body: rows.length === 0 ? `Nenhum limite de gasto definido para ${monthLabel(month)}.` : lines.join('\n'),
        facts,
        summary: {
          tool: 'get_spending_limits',
          label: `limites de gasto de ${monthLabel(month)}`,
          filters: { mes: `${month.year}-${String(month.month).padStart(2, '0')}` },
          itemCount: rows.length,
          truncated: rows.length > shown.length,
        },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
