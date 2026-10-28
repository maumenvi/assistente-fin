import { type LogSink } from '../shared/log.sink.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type LogEvent } from '../../domain/logging/log.event.ts';
import { buildLogEvent } from './build.log.event.ts';
import { extractSubjectIds } from './extract.subject.ids.ts';
import { sanitizeLogInput } from './sanitize.log.input.ts';

/** Descreve a chamada a registrar (spec 017, complemento). */
export interface LoggedCallMeta {
  /** `null` = nao registra (sem sink configurado); `work` roda igual. */
  readonly sink: LogSink | null;
  readonly source: LogEvent['source'];
  readonly operation: string;
  /** Lidos DEPOIS de `work`: podem ser preenchidos durante a chamada (ex.: autenticacao). */
  readonly userId: () => string | null;
  readonly deviceId: () => string | null;
  readonly correlationId: string;
  readonly input?: unknown;
  /** Alternativa a `input` quando o payload so existe depois do `work` (ex.: envelope decifrado). */
  readonly inputLate?: () => unknown;
  /** Padroes: `crypto.randomUUID`, `new Date()` e `performance.now()`. No celular, injete `ids`. */
  readonly ids?: IdGenerator;
  readonly now?: () => Date;
  readonly clockMs?: () => number;
}

/**
 * Roda `work` e registra exatamente um `LogEvent` (sucesso, ou o erro ORIGINAL), relancando o
 * erro intacto. Uma falha do log e engolida: nunca muda o resultado nem o erro (RF-6/RF-7).
 * Miolo comum do IPC, do hub de sync e do celular.
 */
export async function runLoggedCall<T>(meta: LoggedCallMeta, work: () => Promise<T> | T): Promise<T> {
  const clockMs = meta.clockMs ?? (() => performance.now());
  const startedAtMs = clockMs();
  const record = (outcome: 'success' | 'error', error?: unknown): void => {
    if (meta.sink === null) return;
    try {
      const input = meta.inputLate ? meta.inputLate() : meta.input;
      meta.sink.record(
        buildLogEvent({
          id: meta.ids ? meta.ids.next() : globalThis.crypto.randomUUID(),
          timestamp: (meta.now ?? (() => new Date()))().toISOString(),
          source: meta.source,
          operation: meta.operation,
          userId: meta.userId(),
          deviceId: meta.deviceId(),
          correlationId: meta.correlationId,
          startedAtMs,
          nowMs: clockMs(),
          outcome,
          error,
          subjectIds: extractSubjectIds(input),
          input: sanitizeLogInput(meta.operation, input),
        }),
      );
    } catch {
      // RF-7: o log nunca muda o resultado da chamada.
    }
  };
  try {
    const result = await work();
    record('success');
    return result;
  } catch (error) {
    record('error', error);
    throw error;
  }
}
