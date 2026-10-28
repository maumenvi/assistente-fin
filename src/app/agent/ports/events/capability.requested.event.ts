import { type AgentEventBase } from './agent.event.base.ts';

/** Um pedido de capacidade nasceu nesta execucao (spec 034): a UI mostra o cartao de aprovacao na mensagem. */
export interface CapabilityRequestedEvent extends AgentEventBase {
  readonly type: 'capability_requested';
  readonly messageId: string;
  readonly requestId: string;
}
