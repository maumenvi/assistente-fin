import { type MessagePart } from '../../../../domain/agent/message.part.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/** As partes da mensagem foram trocadas (ex.: valor nao confirmado mascarado pela verificacao). */
export interface MessageReplacedEvent extends AgentEventBase {
  readonly type: 'message_replaced';
  readonly messageId: string;
  readonly parts: readonly MessagePart[];
}
