import { z } from 'zod';
import { type Conversation } from '../../../domain/agent/conversation.ts';
import { makeConversationTitle } from '../../../domain/agent/make.conversation.title.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { userInputSchema } from './user.input.schema.ts';

/** Cria uma conversa vazia; o titulo vira o da primeira pergunta quando ela for enviada. */
export class NewConversationUseCase {
  private readonly store: AgentStorePort;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(store: AgentStorePort, ids: IdGenerator, clock: Clock) {
    this.store = store;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<Conversation> {
    const parsed = userInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('nova conversa', flat.fieldErrors, flat.formErrors);
    }
    const now = this.clock.now().toISOString();
    const conversation: Conversation = {
      id: this.ids.next(), userId: parsed.data.userId, title: makeConversationTitle(''), status: 'active', createdAt: now, updatedAt: now, lastMessageAt: now,
    };
    await this.store.conversations.create(conversation);
    return conversation;
  }
}
