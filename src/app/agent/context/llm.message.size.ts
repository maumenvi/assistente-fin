import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { estimateTokens } from './estimate.tokens.ts';

/** Tokens estimados de uma mensagem do modelo (texto + chamadas de ferramenta), como a estrategia de contexto conta. */
export function llmMessageSize(message: LlmMessage): number {
  if (message.role === 'tool') return estimateTokens(message.content);
  const text = message.content.map((p) => (p.type === 'text' ? p.text : '')).join('');
  const calls = message.role === 'assistant' ? JSON.stringify(message.toolCalls ?? []) : '';
  return estimateTokens(text + calls);
}
