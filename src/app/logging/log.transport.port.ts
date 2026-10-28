import { type LogEvent } from '../../domain/logging/log.event.ts';

/** Resposta do hub ao lote de logs: gravados (ou descartados por log desligado) e duplicatas. */
export interface SendLogsResult {
  readonly accepted: number;
  readonly duplicates: number;
}

/**
 * Canal que leva os eventos do celular ao desktop pareado (spec 017, complemento RF-22). No app e
 * o `HttpSyncTransport` (rota segura `/sync/v1/logs`); nos testes, um transporte falso.
 */
export interface LogTransport {
  /** Envia o lote; resolve so se o desktop confirmou (so entao o celular apaga). */
  sendLogs(events: readonly LogEvent[]): Promise<SendLogsResult>;
}
