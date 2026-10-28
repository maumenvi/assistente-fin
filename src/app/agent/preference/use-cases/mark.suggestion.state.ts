import { type AgentStorePort } from '../../ports/store/agent.store.port.ts';

/** Atualiza o estado da parte `suggestion` na mensagem em que ela apareceu (se for informada). */
export async function markSuggestionState(store: AgentStorePort, userId: string, conversationId: string | undefined, messageId: string | undefined, preferenceId: string, state: 'confirmed' | 'dismissed'): Promise<void> {
  if (conversationId === undefined || messageId === undefined) return;
  const messages = await store.messages.list(userId, conversationId, { limit: 50 });
  const message = messages.find((m) => m.id === messageId);
  if (message === undefined) return;
  const parts = message.parts.map((p) => (p.type === 'suggestion' && p.preferenceId === preferenceId ? { ...p, state } : p));
  await store.messages.update(userId, messageId, { parts });
}
