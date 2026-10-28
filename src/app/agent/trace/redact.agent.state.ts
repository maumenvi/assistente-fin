import { type AgentState } from '../graph/agent.state.ts';
import { redactAttachmentParts } from './redact.attachment.parts.ts';

/**
 * Estado da execucao como vai para o armazenamento (checkpoint, estado final, evento `run_started` do trace): o conteudo de
 * anexos nas mensagens do turno vira marcador (spec 036, FR-015). A execucao nunca e retomada a partir do estado gravado
 * (recuperacao so marca como interrompida; "tentar de novo" remonta o turno dos anexos guardados), entao nada se perde.
 */
export function redactAgentState(state: AgentState): AgentState {
  return { ...state, turnMessages: redactAttachmentParts(state.turnMessages) };
}
