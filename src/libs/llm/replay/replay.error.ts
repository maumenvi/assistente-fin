/** Falha gravada numa fixture; vira o erro de dominio correspondente ao ser reproduzida. */
export interface ReplayError {
  readonly code:
    | 'LLM_UNAVAILABLE'
    | 'LLM_AUTH'
    | 'LLM_KEY_EXPIRED'
    | 'LLM_RATE_LIMITED'
    | 'LLM_QUOTA'
    | 'LLM_MODEL_NOT_FOUND'
    | 'LLM_PROTOCOL'
    | 'LLM_PROTOCOL_CHUNK'
    | 'LLM_PROTOCOL_END'
    | 'LLM_PROTOCOL_EMPTY';
  readonly message?: string | undefined;
  readonly retryAfterMs?: number | undefined;
  /** Ja saiu conteudo antes da falha (padrao: verdadeiro se a fixture trouxe texto/ferramenta). */
  readonly emittedContent?: boolean | undefined;
}
