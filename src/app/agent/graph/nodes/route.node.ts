import { RunCancelledError } from '../../../../domain/agent/errors/run.cancelled.error.ts';
import { type Intent } from '../../../../domain/agent/intent.ts';
import { collectStream } from '../../../../libs/llm/collect.stream.ts';
import { type AgentNodeName } from '../agent.node.name.ts';
import { type AgentState } from '../agent.state.ts';
import { defineNode } from '../define.node.ts';
import { type NodeContext } from '../node.context.ts';
import { type StepDetail } from '../step.detail.ts';
import { parseRouterOutput } from './parse.router.output.ts';
import { routeByRules } from './route.rules.ts';
import { turnHasAttachments, userTextOfTurn } from './user.text.of.turn.ts';

/**
 * No `route` (spec 031, T068): descobre a intencao do pedido. As regras pt-BR resolvem quase
 * tudo sem modelo; so se inconclusivo chama o modelo rapido (saida estruturada, ou texto livre
 * com leitura tolerante quando o modelo nao suporta). Falha do roteador -> `query`.
 * `direct`, `settings_request` e `out_of_scope` seguem para `answer`; `query`, `preference` (spec 032,
 * so com as ferramentas de memoria) e `write_request` (spec 033, com `propose_changes`) seguem para
 * `react`. Sem ferramentas de planejamento, `write_request` ainda recebe a resposta fixa "so consulto".
 */
export const routeNode = defineNode<AgentNodeName, AgentState, NodeContext, 'answer' | 'react'>({
  to: ['answer', 'react'],
  async run(state, ctx) {
    const text = userTextOfTurn(state.turnMessages);
    const byRules = routeByRules(text, { hasAttachments: turnHasAttachments(state.turnMessages) });
    if (byRules !== null) return decide(state, byRules, ctx);

    const routed = ctx.selectStepLlm?.({
      node: 'route',
      intent: state.intent,
      stepIndex: state.counters.llmCalls,
      toolCallCount: state.counters.toolCalls,
      hasFailures: state.counters.argRepairAttempts > 0 || state.counters.correctionAttempts > 0,
    });
    const picked =
      routed !== undefined
        ? { llm: routed.llm, answeredBy: routed.role, tier: routed.tier, model: routed.model }
        : { ...ctx.llm('fast'), tier: undefined, model: undefined };
    const { llm, answeredBy } = picked;
    try {
      const result = await collectStream(
        llm.stream(
          {
            system: ctx.prompts.routerSystem(),
            messages: [{ role: 'user', content: [{ type: 'text', text }] }],
            ...(llm.capabilities.structuredOutput ? { output: { name: 'intent', schema: ctx.prompts.routerSchema } } : {}),
            temperature: 0,
            maxOutputTokens: 60,
          },
          ctx.signal,
        ),
      );
      const intent = parseRouterOutput(result.text) ?? 'query';
      return decide(
        { ...state, counters: { ...state.counters, llmCalls: state.counters.llmCalls + 1 } },
        intent,
        ctx,
        {
          role: answeredBy,
          ...(picked.tier === undefined ? {} : { tier: picked.tier }),
          ...(picked.model === undefined ? {} : { model: picked.model }),
          ...(result.usage === null ? {} : { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cachedTokens: result.usage.cachedTokens ?? 0, costMicroUsd: result.usage.costMicroUsd ?? null }),
          response: { intent },
        },
      );
    } catch (error) {
      if (error instanceof RunCancelledError || ctx.signal.aborted) throw error;
      ctx.log.warn('roteador falhou; seguindo como consulta', { error: error instanceof Error ? error.message : String(error) });
      return decide(state, 'query', ctx);
    }
  },
});

function decide(state: AgentState, intent: Intent, ctx: NodeContext, detail?: StepDetail) {
  const planning = intent === 'write_request' && ctx.planTools !== undefined;
  const next = intent === 'query' || intent === 'preference' || planning ? ('react' as const) : ('answer' as const);
  return Promise.resolve({ next, state: { ...state, intent }, ...(detail === undefined ? {} : { detail }) });
}
