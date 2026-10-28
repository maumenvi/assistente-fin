import { z } from 'zod';
import { type Conversation } from '../../../domain/agent/conversation.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { listConversationsInputSchema } from './list.conversations.input.schema.ts';

/** Lista as conversas do usuario, da mais recente para a mais antiga (50 por pagina). */
export class ListConversationsUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<Conversation[]> {
    const parsed = listConversationsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar conversas', flat.fieldErrors, flat.formErrors);
    }
    const { userId, limit, before } = parsed.data;
    const rows = await this.store.conversations.list(userId, before === undefined ? { limit } : { limit, before });
    return rows.filter((row) => row.status === 'active');
  }
}
