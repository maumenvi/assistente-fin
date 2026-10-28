import { type LogEvent } from '../../domain/logging/log.event.ts';

/**
 * Porta para registrar eventos de log (spec 017, RF-15).
 *
 * Sincrona e sem `Promise` de proposito (RF-6): quem loga nao espera nem trata erro. O adapter
 * decide como e quando persistir. NUNCA lanca (RF-7) - qualquer falha interna e engolida pelo
 * adapter; a chamada MCP/IPC nunca falha por causa do log.
 */
export interface LogSink {
  /** Registra o evento sem bloquear e sem lancar. */
  record(event: LogEvent): void;
}
