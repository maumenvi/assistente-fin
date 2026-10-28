import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { countFact } from './shared/count.fact.ts';
import { moneyFact } from './shared/money.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const inputSchema = z.object({});

type Args = z.infer<typeof inputSchema>;

/**
 * `list_fixed_expenses` (spec 031, T064): gastos fixos cadastrados (ate 10), com total mensal e
 * quantidade. O gasto fixo vale para TODO mes e conta pago ou nao (spec 021), por isso nao ha
 * argumento de mes; "pago" aparece so como status. Somente leitura.
 */
export function listFixedExpensesTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'list_fixed_expenses',
    description: 'Gastos fixos mensais (aluguel, assinaturas...) com valor esperado, dia de vencimento e se esta marcado como pago. O total vale para qualquer mes.',
    effect: 'read',
    input: inputSchema,
    async run(_args, ctx) {
      const listed = await deps.listFixedExpenses.execute({ userId: ctx.userId });
      const rows = [...listed].sort((a, b) => b.item.expectedAmount.cents - a.item.expectedAmount.cents || a.item.id.localeCompare(b.item.id));
      const totalCents = rows.reduce((sum, { item }) => sum + item.expectedAmount.cents, 0);
      const shown = rows.slice(0, ctx.limits.maxItems);
      const facts: Fact[] = [
        moneyFact('total', 'total mensal de gastos fixos', totalCents),
        countFact('quantidade', 'quantidade de gastos fixos', rows.length),
        ...shown.map(({ item }) => moneyFact(`fixo.${item.id}`, `valor de ${sanitizeText(item.description ?? 'gasto fixo', 40)}`, item.expectedAmount.cents)),
      ];
      const lines = shown.map(
        ({ item, categoryName }) =>
          `- ${sanitizeText(item.description ?? 'gasto fixo', 60)}: ${formatBrl(item.expectedAmount.cents)}, vence todo dia ${item.dueDay} (${sanitizeText(categoryName, 40)}; ${item.paid ? 'marcado como pago' : 'nao marcado como pago'}) [id ${item.id}]`,
      );
      return buildToolResult({
        tool: 'list_fixed_expenses',
        body: rows.length === 0 ? 'Nenhum gasto fixo cadastrado.' : `Total mensal: ${formatBrl(totalCents)} em ${rows.length} gastos fixos\n${lines.join('\n')}`,
        facts,
        summary: { tool: 'list_fixed_expenses', label: 'gastos fixos', filters: {}, itemCount: rows.length, truncated: rows.length > shown.length },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
