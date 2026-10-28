import { z } from 'zod';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { countFact } from './shared/count.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const inputSchema = z.object({});

type Args = z.infer<typeof inputSchema>;

/**
 * `list_categories` (spec 031, T062): categorias do usuario (as de sistema - saldo inicial,
 * ajuste, transferencia, pagamento de fatura - ficam de fora). Amostra de ate 10 nomes e o total
 * como fato `count`. Somente leitura.
 */
export function listCategoriesTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'list_categories',
    description: 'Lista as categorias de gasto e ganho do usuario. Use para saber que nomes de categoria existem antes de filtrar lancamentos.',
    effect: 'read',
    input: inputSchema,
    async run(_args, ctx) {
      const all = await deps.listCategories.execute({ userId: ctx.userId });
      const visible = all
        .filter((c) => !c.isSystemBalance && !c.isSystemOpeningBalance && !c.isSystemAdjustment && !c.isSystemTransfer && !c.isSystemCardPayment)
        .sort((a, b) => a.name.value.localeCompare(b.name.value));
      const shown = visible.slice(0, ctx.limits.maxItems);
      const lines = shown.map((c) => `- ${sanitizeText(c.name.value, 40)}${c.isDefault ? ' (padrao, sem classificacao)' : ''} [id ${c.id}]`);
      return buildToolResult({
        tool: 'list_categories',
        body: visible.length === 0 ? 'Nenhuma categoria cadastrada.' : `Total: ${visible.length} categorias\n${lines.join('\n')}`,
        facts: [countFact('categorias', 'quantidade de categorias', visible.length)],
        summary: { tool: 'list_categories', label: 'categorias', filters: {}, itemCount: visible.length, truncated: visible.length > shown.length },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
