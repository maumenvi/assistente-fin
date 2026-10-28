import { type LogSink } from '../../shared/log.sink.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type LogEvent } from '../../../domain/logging/log.event.ts';
import { buildLogEvent } from '../../logging/build.log.event.ts';
import { type AgentLogPort } from '../ports/observe/agent.log.port.ts';
import { namedError } from './named.error.ts';
import { redact } from './redact.ts';

/** Dependencias do `LogSinkAgentLog`. */
export interface LogSinkAgentLogDeps {
  readonly source: LogEvent['source'];
  readonly ids: IdGenerator;
  readonly now?: () => Date;
  /** Onde escrever quando nao ha `LogSink` (padrao: `console`). */
  readonly fallback?: (level: 'warn' | 'error', message: string) => void;
}

/**
 * Log interno do agente sobre o `LogSink` da spec 017 (1 `LogEvent` `agent.internal` por aviso).
 * Sem `LogSink`, cai para `console.warn/error` com prefixo `[agent]`. Os campos passam por
 * `redact()`. Nunca lanca.
 */
export class LogSinkAgentLog implements AgentLogPort {
  private readonly sink: LogSink | null;
  private readonly deps: LogSinkAgentLogDeps;

  public constructor(sink: LogSink | null, deps: LogSinkAgentLogDeps) {
    this.sink = sink;
    this.deps = deps;
  }

  public warn(message: string, fields?: Readonly<Record<string, unknown>>): void {
    this.write('warn', message, fields);
  }

  public error(message: string, fields?: Readonly<Record<string, unknown>>): void {
    this.write('error', message, fields);
  }

  private write(level: 'warn' | 'error', message: string, fields: Readonly<Record<string, unknown>> | undefined): void {
    try {
      const safeMessage = String(redact(message));
      if (this.sink === null) {
        (this.deps.fallback ?? defaultFallback)(level, `[agent] ${safeMessage}`);
        return;
      }
      const now = (this.deps.now ?? (() => new Date()))();
      this.sink.record(
        buildLogEvent({
          id: this.deps.ids.next(),
          timestamp: now.toISOString(),
          source: this.deps.source,
          operation: 'agent.internal',
          userId: null,
          correlationId: this.deps.ids.next(),
          startedAtMs: 0,
          nowMs: 0,
          outcome: 'error',
          error: namedError(level === 'warn' ? 'AgentWarning' : 'AgentError', safeMessage),
          input: fields === undefined ? null : redact(fields),
        }),
      );
    } catch {
      // o log nunca derruba o agente
    }
  }
}

function defaultFallback(level: 'warn' | 'error', message: string): void {
  if (level === 'warn') console.warn(message);
  else console.error(message);
}
