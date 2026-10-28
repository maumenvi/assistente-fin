import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type ViewMessage } from './view.message.ts';

/** Mensagem salva -> mensagem de tela. */
export function toViewMessage(message: AgentMessage): ViewMessage {
  return { id: message.id, role: message.role, parts: message.parts, status: message.status, errorCode: message.errorCode, seq: message.seq, runId: message.runId };
}
