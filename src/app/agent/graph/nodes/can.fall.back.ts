import { LlmError } from '../../../../domain/agent/errors/llm.error.ts';

/** O perfil alternativo so entra em falha retriavel que ocorreu ANTES de qualquer conteudo. */
export function canFallBack(error: unknown): boolean {
  return error instanceof LlmError && error.retriable && !error.emittedContent;
}
