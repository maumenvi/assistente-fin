import { type Conversation } from '../../domain/agent/conversation.ts';
import { type ConversationStorePort } from '../../app/agent/ports/store/conversation.store.port.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Conversas do agente em memoria. Guarda copias (como um banco faria) e filtra sempre por `userId`. */
export class FakeConversationStore implements ConversationStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public create(conversation: Conversation): Promise<void> {
    this.data.conversations.set(conversation.id, structuredClone(conversation));
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<Conversation | null> {
    const found = this.data.conversations.get(id);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public list(userId: string, options: { readonly limit: number; readonly before?: string }): Promise<Conversation[]> {
    const rows = [...this.data.conversations.values()]
      .filter((c) => c.userId === userId && (options.before === undefined || c.lastMessageAt < options.before))
      .sort((a, b) => (a.lastMessageAt === b.lastMessageAt ? b.id.localeCompare(a.id) : b.lastMessageAt.localeCompare(a.lastMessageAt)))
      .slice(0, options.limit);
    return Promise.resolve(structuredClone(rows));
  }

  public touch(userId: string, id: string, lastMessageAt: string): Promise<void> {
    const found = this.data.conversations.get(id);
    if (found && found.userId === userId) {
      this.data.conversations.set(id, { ...found, lastMessageAt, updatedAt: lastMessageAt });
    }
    return Promise.resolve();
  }

  public delete(userId: string, id: string): Promise<void> {
    const found = this.data.conversations.get(id);
    if (found && found.userId === userId) this.data.cascadeDelete(id);
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    for (const conversation of [...this.data.conversations.values()]) {
      if (conversation.userId === userId) this.data.cascadeDelete(conversation.id);
    }
    return Promise.resolve();
  }
}
