import { type AgentMessage } from '../../domain/agent/agent.message.ts';
import { type MessagePatch } from '../../app/agent/ports/store/message.patch.ts';
import { type MessageStorePort } from '../../app/agent/ports/store/message.store.port.ts';
import { type NewAgentMessage } from '../../app/agent/ports/store/new.agent.message.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Mensagens do agente em memoria; o `seq` e atribuido aqui (crescente, sem lacunas, por conversa). */
export class FakeMessageStore implements MessageStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public append(message: NewAgentMessage): Promise<AgentMessage> {
    const conversation = this.data.conversations.get(message.conversationId);
    if (!conversation || conversation.userId !== message.userId) {
      return Promise.reject(new Error('conversa inexistente para este usuario'));
    }
    const list = this.data.messages.get(message.conversationId) ?? [];
    const stored: AgentMessage = structuredClone({ ...message, seq: (list[list.length - 1]?.seq ?? 0) + 1 });
    this.data.messages.set(message.conversationId, [...list, stored]);
    return Promise.resolve(structuredClone(stored));
  }

  public update(userId: string, id: string, patch: MessagePatch): Promise<void> {
    for (const [conversationId, list] of this.data.messages) {
      const index = list.findIndex((m) => m.id === id && m.userId === userId);
      if (index === -1) continue;
      const current = list[index] as AgentMessage;
      const next: AgentMessage = {
        ...current,
        ...(patch.parts === undefined ? {} : { parts: structuredClone(patch.parts) }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.errorCode === undefined ? {} : { errorCode: patch.errorCode }),
        ...(patch.runId === undefined ? {} : { runId: patch.runId }),
      };
      const copy = [...list];
      copy[index] = next;
      this.data.messages.set(conversationId, copy);
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  public list(
    userId: string,
    conversationId: string,
    options: { readonly limit: number; readonly beforeSeq?: number },
  ): Promise<AgentMessage[]> {
    const rows = (this.data.messages.get(conversationId) ?? [])
      .filter((m) => m.userId === userId && (options.beforeSeq === undefined || m.seq < options.beforeSeq))
      .slice(-options.limit);
    return Promise.resolve(structuredClone(rows));
  }
}
