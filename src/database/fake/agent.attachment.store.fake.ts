import { type AttachmentStats, type AttachmentStorePort } from '../../app/agent/attachment/ports/attachment.store.port.ts';
import { type Attachment } from '../../domain/agent/attachment/attachment.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Anexos em memoria (spec 036). Filtra por `userId` e guarda copias. */
export class FakeAttachmentStore implements AttachmentStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public save(attachment: Attachment): Promise<void> {
    this.data.attachments.set(attachment.id, structuredClone(attachment));
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<Attachment | null> {
    const found = this.data.attachments.get(id);
    return Promise.resolve(found !== undefined && found.userId === userId ? structuredClone(found) : null);
  }

  public listByMessage(userId: string, messageId: string): Promise<Attachment[]> {
    return Promise.resolve([...this.data.attachments.values()].filter((a) => a.userId === userId && a.messageId === messageId).map((a) => structuredClone(a)));
  }

  public listByConversation(userId: string, conversationId: string): Promise<Attachment[]> {
    return Promise.resolve([...this.data.attachments.values()].filter((a) => a.userId === userId && a.conversationId === conversationId).map((a) => structuredClone(a)));
  }

  public delete(userId: string, id: string): Promise<boolean> {
    const found = this.data.attachments.get(id);
    if (found === undefined || found.userId !== userId) return Promise.resolve(false);
    this.data.attachments.delete(id);
    return Promise.resolve(true);
  }

  public deleteByConversation(userId: string, conversationId: string): Promise<number> {
    let removed = 0;
    for (const [id, a] of [...this.data.attachments]) {
      if (a.userId === userId && a.conversationId === conversationId) {
        this.data.attachments.delete(id);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  public deleteAll(userId: string): Promise<number> {
    let removed = 0;
    for (const [id, a] of [...this.data.attachments]) {
      if (a.userId === userId) {
        this.data.attachments.delete(id);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  public stats(userId: string): Promise<AttachmentStats> {
    const mine = [...this.data.attachments.values()].filter((a) => a.userId === userId);
    return Promise.resolve({ count: mine.length, totalBytes: mine.reduce((sum, a) => sum + a.sizeBytes, 0) });
  }
}
