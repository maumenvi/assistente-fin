import { type LogEvent } from '../../domain/logging/log.event.ts';

/** Dados para montar um `LogEvent` (tempos em ms, `startedAtMs`/`nowMs` na mesma base). */
export interface BuildLogEventInput {
  id: string;
  timestamp: string;
  source: LogEvent['source'];
  operation: string;
  userId: string | null;
  deviceId?: string | null;
  correlationId: string;
  startedAtMs: number;
  nowMs: number;
  outcome: 'success' | 'error';
  error?: unknown;
  subjectIds?: Record<string, string>;
  input?: unknown;
}

/** Serializa qualquer valor lancado em `{ name, message, stack }`. */
function serializeError(error: unknown): NonNullable<LogEvent['error']> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack ?? null };
  }
  return { name: 'NonError', message: String(error), stack: null };
}

/**
 * Monta o `LogEvent` de uma chamada (funcao pura, spec 017). `durationMs` nunca fica negativo
 * e `error` so existe quando `outcome === 'error'`.
 */
export function buildLogEvent(data: BuildLogEventInput): LogEvent {
  return {
    id: data.id,
    timestamp: data.timestamp,
    source: data.source,
    operation: data.operation,
    userId: data.userId,
    deviceId: data.deviceId ?? null,
    correlationId: data.correlationId,
    durationMs: Math.max(0, data.nowMs - data.startedAtMs),
    outcome: data.outcome,
    subjectIds: data.subjectIds ?? {},
    error: data.outcome === 'error' ? serializeError(data.error) : null,
    input: data.input ?? null,
  };
}
