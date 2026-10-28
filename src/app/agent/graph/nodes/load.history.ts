import { type AgentMessage } from '../../../../domain/agent/agent.message.ts';
import { type NodeContext } from '../node.context.ts';

/** Quantas mensagens recentes sao lidas para montar o contexto (a estrategia descarta o excesso). */
const HISTORY_LIMIT = 200;

/**
 * Historico da conversa para o modelo: mensagens ja completas ANTES desta execucao, em ordem
 * cronologica. A pergunta atual e a resposta em construcao ficam de fora (a pergunta vai no turno).
 */
export async function loadHistory(ctx: NodeContext): Promise<readonly AgentMessage[]> {
  const all = await ctx.store.messages.list(ctx.userId, ctx.conversationId, { limit: HISTORY_LIMIT });
  return all.filter((m) => m.id !== ctx.userMessageId && m.id !== ctx.assistantMessageId && m.status === 'complete');
}
