import { type LlmMessage } from '../ports/llm/llm.message.ts';

/** Pedido de continuacao acrescentado quando o historico termina em turno do modelo. */
export const CONTINUE_TURN_TEXT = 'Continue exatamente de onde parou, sem repetir o que já escreveu.';

/**
 * Garante que o pedido ao provedor NAO termine em turno do modelo (spec 040, R4): varios provedores
 * recusam com HTTP 400 ("Requests ending with a model turn are not supported"). Se a ultima mensagem
 * e `assistant` sem chamada de ferramenta pendente, acrescenta um turno `user` pedindo a continuacao;
 * qualquer outro final (`user`, `tool`, `assistant` com chamadas) segue intacto. Funcao pura.
 */
export function ensureUserTurnLast(messages: readonly LlmMessage[]): readonly LlmMessage[] {
  const last = messages.at(-1);
  if (last === undefined || last.role !== 'assistant') return messages;
  if (last.toolCalls !== undefined && last.toolCalls.length > 0) return messages;
  return [...messages, { role: 'user', content: [{ type: 'text', text: CONTINUE_TURN_TEXT }] }];
}
