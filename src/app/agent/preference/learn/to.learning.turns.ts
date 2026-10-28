import { type AgentMessage } from '../../../../domain/agent/agent.message.ts';
import { type LearningTurn } from './learning.turn.ts';

/**
 * Mensagens salvas -> turnos do aprendizado (spec 032, FR-008): so o texto das mensagens do USUARIO
 * sobrevive; as do assistente (que carregam resultado de ferramenta) viram turnos de texto vazio.
 */
export function toLearningTurns(messages: readonly AgentMessage[]): LearningTurn[] {
  return messages
    .filter((m) => m.status === 'complete' || m.role === 'user')
    .map((m) => ({
      id: m.id,
      role: m.role,
      text: m.role === 'user' ? m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ') : '',
      at: m.createdAt,
    }));
}
