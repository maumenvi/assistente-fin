/**
 * Evento de log de uma chamada na borda (MCP ou IPC) - spec 017.
 *
 * E um registro de observacao (DTO puro), nao uma entidade com invariantes: nasce na borda,
 * viaja pela porta `LogSink` e e gravado como uma linha JSON. Vive em `domain/` porque a porta
 * (em `app/shared/`) precisa referencia-lo sem depender de infraestrutura.
 */
export interface LogEvent {
  readonly id: string;
  /** Instante da conclusao da chamada, ISO 8601. */
  readonly timestamp: string;
  /** `sync` = rotas do hub no desktop; `mobile` = eventos gerados no app Android. */
  readonly source: 'mcp' | 'ipc' | 'sync' | 'mobile';
  /** Nome da tool MCP ou do canal IPC. */
  readonly operation: string;
  readonly userId: string | null;
  /** Aparelho pareado (em `sync` e `mobile`); `null` em `mcp`/`ipc`. */
  readonly deviceId: string | null;
  /** Agrupa chamadas relacionadas (mesma sessao MCP ou mesmo lote de acao do usuario). */
  readonly correlationId: string;
  /** Duracao da chamada em milissegundos (nunca negativa). */
  readonly durationMs: number;
  readonly outcome: 'success' | 'error';
  /** Ids das entidades manipuladas, ex.: `{ transactionId: '...' }`. */
  readonly subjectIds: Record<string, string>;
  /** Erro original (nome, mensagem e stack) - so quando `outcome === 'error'`. */
  readonly error: { name: string; message: string; stack: string | null } | null;
  /** Payload de negocio da chamada, sem mascaramento (RF-12). */
  readonly input: unknown;
}
