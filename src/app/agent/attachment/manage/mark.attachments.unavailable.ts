import { type MessagePart } from '../../../../domain/agent/message.part.ts';
import { type AgentStorePort } from '../../ports/store/agent.store.port.ts';

/** Mensagens a varrer por conversa ao marcar partes de anexo como apagadas. */
const MESSAGE_SCAN_LIMIT = 10_000;

/**
 * Marca como `available=false` as partes de anexo (da conversa) cujos ids foram apagados: a mensagem continua, o cartao passa a
 * mostrar "Anexo apagado" (spec 036, FR-013). So reescreve as mensagens que tinham alguma dessas partes.
 */
export async function markAttachmentsUnavailable(store: AgentStorePort, userId: string, conversationId: string, ids: ReadonlySet<string>): Promise<void> {
  if (ids.size === 0) return;
  const messages = await store.messages.list(userId, conversationId, { limit: MESSAGE_SCAN_LIMIT });
  for (const message of messages) {
    if (!message.parts.some((p) => p.type === 'attachment' && ids.has(p.attachmentId) && p.available)) continue;
    const parts: MessagePart[] = message.parts.map((p) => (p.type === 'attachment' && ids.has(p.attachmentId) ? { ...p, available: false } : p));
    await store.messages.update(userId, message.id, { parts });
  }
}
