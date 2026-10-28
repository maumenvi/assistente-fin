import { type AgentEventBase } from './agent.event.base.ts';

/** O pedido de pasta ou de edicao foi decidido (ou a execucao acabou): o cartao sai do chat. */
export interface FileRequestResolvedEvent extends AgentEventBase {
  readonly type: 'file_request_resolved';
  readonly requestId: string;
  readonly outcome: 'allowed' | 'denied';
}
