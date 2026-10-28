import { type AgentMessage } from '../../../../domain/agent/agent.message.ts';
import { type MessagePatch } from './message.patch.ts';
import { type NewAgentMessage } from './new.agent.message.ts';

/** Mensagens das conversas. */
export interface MessageStorePort {
  /** Atribui o `seq` (crescente, sem lacunas, unico por conversa) e devolve a mensagem gravada. */
  append(message: NewAgentMessage): Promise<AgentMessage>;
  update(userId: string, id: string, patch: MessagePatch): Promise<void>;
  /** Em ordem cronologica; `beforeSeq` pagina para tras. */
  list(
    userId: string,
    conversationId: string,
    options: { readonly limit: number; readonly beforeSeq?: number },
  ): Promise<AgentMessage[]>;
}
