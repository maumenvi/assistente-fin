import { z } from 'zod';
import { requestCapability } from '../engine/request.capability.ts';
import { type AgentTool } from '../../tools/agent.tool.ts';
import { buildToolError } from '../../tools/shared/build.tool.error.ts';
import { sanitizeText } from '../../tools/shared/sanitize.text.ts';
import { MAX_REQUESTS_PER_RUN, PerRunCounter, sourceOf, type CapabilityToolDeps } from './capability.tool.deps.ts';

const inputSchema = z.object({
  query: z.string().trim().min(2).max(120).describe('O que procurar, em poucas palavras (ex.: "cotação de moedas").'),
  reason: z.string().trim().min(2).max(300).describe('Por que o usuário precisa disto, em uma frase. Será mostrada a ele como "informado pelo assistente".'),
  url: z.string().trim().max(300).optional().describe('Endereço de servidor que o PRÓPRIO USUÁRIO escreveu no pedido. Só informe se ele colou um endereço.'),
});
type Args = z.infer<typeof inputSchema>;

/**
 * `find_capability` (spec 034, FR-001): quando falta uma capacidade (cotacao, dado externo), busca no catalogo e
 * cria o PEDIDO de aprovacao. Nunca conecta nada: so o usuario aprova, na tela.
 */
export function findCapabilityTool(deps: CapabilityToolDeps): AgentTool<Args> {
  const counter = new PerRunCounter();
  return {
    id: 'find_capability',
    description:
      'Use quando o usuário pede algo que as ferramentas do app não resolvem (ex.: cotação de moeda, dado externo). Procura no catálogo e cria um PEDIDO de aprovação; nada é conectado até o usuário aprovar. Se o usuário colou um endereço de servidor, passe-o em url.',
    effect: 'external',
    input: inputSchema,
    async run(args, ctx) {
      if (!counter.take(ctx.turn?.runId ?? 'sem-execucao', MAX_REQUESTS_PER_RUN)) return buildToolError('find_capability', { code: 'failed', message: 'limite de pedidos de capacidade desta resposta atingido; explique ao usuário o que falta' });
      const userText = ctx.turn?.userText ?? '';
      const url = args.url !== undefined && userText.includes(args.url) ? args.url : undefined;
      const src = sourceOf(ctx);
      const outcome = await requestCapability(deps.engine, { userId: ctx.userId, ...src, query: args.query, reason: args.reason, customUrl: url });
      const done = (body: string, count: number, requestIds: readonly string[] = []) => ({
        ok: true as const,
        contentForModel: `<dados origem="find_capability">\n${body}\n</dados>`.slice(0, ctx.limits.maxChars),
        facts: [],
        summary: { tool: 'find_capability', label: `Procurei uma capacidade: ${sanitizeText(args.query, 60)}`, filters: {}, itemCount: count, truncated: false },
        hidden: true as const,
        ...(requestIds.length > 0 ? { capabilityRequestIds: requestIds } : {}),
      });
      if (outcome.kind === 'none') {
        const note = outcome.failures.length > 0 ? ` (fontes fora do ar: ${outcome.failures.map((f) => f.source).join(', ')})` : '';
        return done(`STATUS: nada_encontrado\nNão há uma capacidade no catálogo para isto${note}. Diga ao usuário, em uma frase, que não consegue fazer isso com o que o app tem.`, 0);
      }
      if (outcome.kind === 'already_active') {
        const names = outcome.capabilities.map((c) => `${c.slug} (${c.name})`).join(', ');
        return done(`STATUS: ja_conectada\nJá está conectada: ${names}. Use list_capability_tools com o slug e depois call_capability_tool.`, outcome.capabilities.length);
      }
      const names = outcome.requests.map((r) => `${sanitizeText(r.candidate.name, 60)} (${r.candidate.badge === 'curated' ? 'curado pelo app' : r.candidate.badge === 'official_registry' ? 'registro oficial' : 'não verificado'})`).join('; ');
      return done(`STATUS: pedido_criado\nCriei ${String(outcome.requests.length)} pedido(s) de aprovação: ${names}. NADA foi conectado: o usuário decide no cartão que aparece abaixo da sua resposta. Diga isso em uma frase e PARE; não tente usar a capacidade ainda.`, outcome.requests.length, outcome.requests.map((r) => r.id));
    },
  };
}
