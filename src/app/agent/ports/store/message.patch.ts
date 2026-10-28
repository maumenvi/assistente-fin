import { type MessagePart } from '../../../../domain/agent/message.part.ts';
import { type MessageStatus } from '../../../../domain/agent/agent.message.ts';

/** Alteracao parcial de uma mensagem (texto em streaming, estado final, erro). */
export interface MessagePatch {
  readonly parts?: readonly MessagePart[];
  readonly status?: MessageStatus;
  readonly errorCode?: string | null;
  readonly runId?: string | null;
}
