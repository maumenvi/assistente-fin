import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { toViewMessage } from '../view/to.view.message.ts';
import { type ViewMessage } from '../view/view.message.ts';
import { getConversationMessagesInputSchema } from './get.conversation.messages.input.schema.ts';

/** Mensagens de uma conversa, em ordem cronologica, uma pagina por vez. Conversa de outro usuario -> vazio. */
export class GetConversationMessagesUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<ViewMessage[]> {
    const parsed = getConversationMessagesInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('ler mensagens da conversa', flat.fieldErrors, flat.formErrors);
    }
    const { userId, conversationId, limit, beforeSeq } = parsed.data;
    const conversation = await this.store.conversations.get(userId, conversationId);
    if (conversation === null) return [];
    const rows = await this.store.messages.list(userId, conversationId, beforeSeq === undefined ? { limit } : { limit, beforeSeq });
    return rows.map(toViewMessage);
  }
}
