import { LlmUnavailableError } from '../../../domain/agent/errors/llm.unavailable.error.ts';

/** Falha de conexao (DNS, conexao recusada, reset): sem rede ate o provedor (`OFFLINE`), retentavel antes de conteudo. */
export function mapNetworkError(cause: unknown, emittedContent: boolean): LlmUnavailableError {
  const detail = cause instanceof Error && cause.message !== '' ? `: ${cause.message}` : '';
  return new LlmUnavailableError(`sem conexao com o provedor${detail}`.slice(0, 200), emittedContent, true);
}
