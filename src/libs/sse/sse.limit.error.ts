/** O stream passou do limite defensivo (linha de 1 MiB ou evento de 4 MiB). O chamador converte em erro de dominio. */
export class SseLimitError extends Error {
  public readonly limit: 'line' | 'event';

  public constructor(limit: 'line' | 'event') {
    super(limit === 'line' ? 'linha SSE acima de 1 MiB' : 'evento SSE acima de 4 MiB');
    this.name = 'SseLimitError';
    this.limit = limit;
  }
}
