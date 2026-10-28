import { type ConversationSummary } from '../../domain/agent/summary/conversation.summary.ts';
import { type SummaryStorePort } from '../../app/agent/ports/store/summary.store.port.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Resumo corrente por conversa, em memoria (spec 032). Filtra por `userId` e guarda copias. */
export class FakeSummaryStore implements SummaryStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public getCurrent(userId: string, conversationId: string): Promise<ConversationSummary | null> {
    const found = this.data.summaries.get(conversationId);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public replaceCurrent(summary: ConversationSummary): Promise<void> {
    if (this.data.conversations.has(summary.conversationId)) this.data.summaries.set(summary.conversationId, structuredClone(summary));
    return Promise.resolve();
  }
}
