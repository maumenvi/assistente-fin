import { z } from 'zod';
import { type ConversationSummary } from '../../../domain/agent/summary/conversation.summary.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1, 'userId obrigatorio'), conversationId: z.string().trim().min(1).max(100) });

/** Resumo corrente de uma conversa, para o item "Contexto resumido" (spec 032, FR-019a); `null` se nao houver. */
export class GetConversationSummaryUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<ConversationSummary | null> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('ver resumo da conversa', flat.fieldErrors as Record<string, string[]>, flat.formErrors);
    }
    return this.store.summaries.getCurrent(parsed.data.userId, parsed.data.conversationId);
  }
}
