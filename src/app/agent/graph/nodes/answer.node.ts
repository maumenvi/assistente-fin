import { type MessagePart } from '../../../../domain/agent/message.part.ts';
import { type NoticePart } from '../../../../domain/agent/notice.part.ts';
import { END } from '../end.ts';
import { type AgentNodeName } from '../agent.node.name.ts';
import { type AgentState } from '../agent.state.ts';
import { defineNode } from '../define.node.ts';
import { type NodeContext } from '../node.context.ts';
import { composeSystem } from '../../context/compose.system.ts';
import { appliedParts } from './applied.parts.ts';
import { collectingText } from './collecting.text.ts';
import { loadTurnMemory } from './load.turn.memory.ts';
import { userTextOfTurn } from './user.text.of.turn.ts';
import { loadHistory } from './load.history.ts';
import { SETTINGS_ROUTE } from './settings.route.ts';

/** Texto fixo (sem modelo) como parte `notice` da mensagem. */
function fixedReply(ctx: NodeContext, state: AgentState, notice: NoticePart) {
  return finish(ctx, state, [notice], notice.text, { type: 'notice', notice });
}

async function finish(
  ctx: NodeContext,
  state: AgentState,
  parts: readonly MessagePart[],
  finalText: string,
  event?: { type: 'notice'; notice: NoticePart },
) {
  await ctx.store.messages.update(ctx.userId, ctx.assistantMessageId, { parts, status: 'complete' });
  if (event !== undefined) ctx.emit({ type: 'notice', messageId: ctx.assistantMessageId, notice: event.notice });
  return { next: END, state: { ...state, finalText } };
}

/**
 * No `answer` (spec 031, T069): responde sem consultar dados. `write_request`, `out_of_scope` e
 * `settings_request` usam TEXTO FIXO, sem modelo e sem tocar em nada alem da mensagem do
 * assistente (a configuracao so ganha um botao - o agente nunca a altera, FR-030). `direct`
 * (saudacao, "o que voce faz?") responde com o modelo rapido, sem ferramentas.
 */
export const answerNode = defineNode<AgentNodeName, AgentState, NodeContext, typeof END>({
  to: [END],
  async run(state, ctx) {
    const { canned } = ctx.prompts;
    switch (state.intent) {
      case 'write_request':
        return fixedReply(ctx, state, { type: 'notice', kind: 'canned_write', text: canned.writeRequest() });
      case 'out_of_scope':
        return fixedReply(ctx, state, { type: 'notice', kind: 'canned_scope', text: canned.outOfScope() });
      case 'settings_request':
        return fixedReply(ctx, state, {
          type: 'notice',
          kind: 'settings_shortcut',
          text: canned.settingsRequest(),
          action: { label: canned.settingsButtonLabel(), route: SETTINGS_ROUTE },
        });
      default:
        break;
    }
    const { llm, answeredBy } = ctx.llm('fast');
    const history = await loadHistory(ctx);
    const memory = await loadTurnMemory(ctx, userTextOfTurn(state.turnMessages), history);
    const system = composeSystem(ctx.prompts.system({ today: ctx.clock.now(), capabilities: { ...llm.capabilities, tools: false } }), { ...memory });
    const messages = ctx.contextStrategy.build({ system, history, turn: state.turnMessages, capabilities: llm.capabilities, ...memory });
    const collected = await collectingText(llm.stream({ system, messages, temperature: 0.3 }, ctx.signal), (text) =>
      ctx.emit({ type: 'text_delta', messageId: ctx.assistantMessageId, text }),
    );
    const appliedIds = memory.preferences.map((p) => p.id);
    const parts: MessagePart[] = [{ type: 'text', text: collected.text }, ...appliedParts(appliedIds)];
    const next = await finish(ctx, { ...state, appliedPreferenceIds: appliedIds, counters: { ...state.counters, llmCalls: state.counters.llmCalls + 1 } }, parts, collected.text);
    if (appliedIds.length > 0) ctx.emit({ type: 'message_replaced', messageId: ctx.assistantMessageId, parts });
    return {
      ...next,
      detail: {
        role: answeredBy,
        ...(collected.usage === null
          ? {}
          : { inputTokens: collected.usage.inputTokens, outputTokens: collected.usage.outputTokens, cachedTokens: collected.usage.cachedTokens ?? 0, costMicroUsd: collected.usage.costMicroUsd ?? null }),
      },
    };
  },
});
