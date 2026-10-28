import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';

const PAGE = 200;

/** Mensagens da conversa que o resumo ainda nao cobre (`seq > coveredToSeq`), em ordem cronologica. */
export async function loadUncovered(store: AgentStorePort, userId: string, conversationId: string, coveredToSeq: number): Promise<AgentMessage[]> {
  const out: AgentMessage[] = [];
  let beforeSeq: number | undefined;
  for (;;) {
    const page = await store.messages.list(userId, conversationId, { limit: PAGE, ...(beforeSeq === undefined ? {} : { beforeSeq }) });
    if (page.length === 0) break;
    out.unshift(...page.filter((m) => m.seq > coveredToSeq));
    const first = page[0] as AgentMessage;
    if (first.seq <= coveredToSeq + 1 || page.length < PAGE) break;
    beforeSeq = first.seq;
  }
  return out;
}
