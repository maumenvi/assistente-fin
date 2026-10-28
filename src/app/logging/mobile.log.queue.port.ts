import { type LogEvent } from '../../domain/logging/log.event.ts';

/** Estado da fila de logs do celular, para a tela de configuracao (spec 017, RF-24). */
export interface MobileLogQueueStats {
  /** Eventos aguardando envio ao desktop. */
  readonly pending: number;
  /** Soma dos bytes dos eventos pendentes. */
  readonly bytes: number;
  /** Eventos descartados pelo teto (bytes/idade), acumulado. */
  readonly dropped: number;
  /** Ultimo envio confirmado pelo desktop (ISO 8601), ou `null`. */
  readonly lastSentAt: string | null;
}

/** Limites da fila do celular (spec 017, RF-23). */
export interface MobileLogQueueLimits {
  readonly maxBytes: number;
  readonly maxAgeDays: number;
  readonly now: Date;
}

/** Teto padrao da fila: 5 MB ou 7 dias, o que ocorrer primeiro (RF-23). */
export const MOBILE_LOG_QUEUE_LIMITS = { maxBytes: 5 * 1024 * 1024, maxAgeDays: 7 } as const;

/**
 * Fila duravel de eventos de log do celular (spec 017, complemento RF-21..RF-24): guarda ate o
 * desktop confirmar o recebimento. Ordem de envio = ordem de chegada. Persistencia no SQLite
 * cifrado do aparelho (`src/database/sqlite/mobile.log.queue.sqlite.ts`).
 */
export interface MobileLogQueue {
  /** Acrescenta eventos; um `id` ja presente e ignorado. */
  append(events: readonly LogEvent[]): Promise<void>;
  /** Os `limit` eventos mais antigos, sem remover. */
  peek(limit: number): Promise<LogEvent[]>;
  /** Remove os eventos enviados e confirmados. */
  ack(ids: readonly string[]): Promise<void>;
  stats(): Promise<MobileLogQueueStats>;
  /** Aplica o teto de bytes e de idade; devolve quantos eventos descartou (e soma em `dropped`). */
  trim(limits: MobileLogQueueLimits): Promise<number>;
  /** Esvazia a fila (ao desparear) sem mexer na chave liga/desliga. */
  clear(): Promise<void>;
  getEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  markSent(at: Date): Promise<void>;
}
