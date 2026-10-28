import { type LogSink } from '../../shared/log.sink.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type LogEvent } from '../../../domain/logging/log.event.ts';
import { buildLogEvent } from '../../logging/build.log.event.ts';
import { namedError } from '../log/named.error.ts';
import { redact } from '../log/redact.ts';
import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';
import { type TraceEvent } from '../ports/observe/trace.event.ts';

/** Dependencias do `LogSinkTrace`. */
export interface LogSinkTraceDeps {
  /** `ipc` no desktop; no Android o hub regrava como `mobile`. */
  readonly source: LogEvent['source'];
  readonly ids: IdGenerator;
  readonly now?: () => Date;
}

/**
 * Trace que envia um RESUMO ao `LogSink` da spec 017 (FR-038): 1 `LogEvent` por passo
 * (`agent.node.<no>`) e 1 por execucao (`agent.run`). Nunca leva prompts, respostas brutas nem
 * chaves - esses ficam so no armazenamento do agente. `LogSink` ausente descarta. Nao lanca.
 */
export class LogSinkTrace implements AgentTracePort {
  private readonly sink: LogSink | null;
  private readonly deps: LogSinkTraceDeps;

  public constructor(sink: LogSink | null, deps: LogSinkTraceDeps) {
    this.sink = sink;
    this.deps = deps;
  }

  public emit(event: TraceEvent): void {
    if (this.sink === null) return;
    try {
      const built = this.build(event);
      if (built !== null) this.sink.record(built);
    } catch {
      // o log nunca derruba o agente
    }
  }

  public flush(): Promise<void> {
    return Promise.resolve();
  }

  private build(event: TraceEvent): LogEvent | null {
    const timestamp = (this.deps.now ?? (() => new Date()))().toISOString();
    const base = { id: this.deps.ids.next(), timestamp, source: this.deps.source, startedAtMs: 0 };
    if (event.type === 'step') {
      const { step } = event;
      return buildLogEvent({
        ...base,
        operation: `agent.node.${step.node}`,
        userId: event.userId,
        correlationId: step.runId,
        nowMs: step.durationMs,
        outcome: step.status === 'error' ? 'error' : 'success',
        error: step.error === null ? undefined : namedError(step.error.code, step.error.message),
        subjectIds: { runId: step.runId },
        input: {
          seq: step.seq,
          role: step.role,
          model: step.model,
          inputTokens: step.inputTokens,
          outputTokens: step.outputTokens,
          cachedTokens: step.cachedTokens,
          costMicroUsd: step.costMicroUsd,
          toolCalls: redact(step.toolCalls.map((c) => ({ name: c.name, args: c.args, resultSummary: c.resultSummary, ms: c.ms }))),
        },
      });
    }
    if (event.type === 'run_finished') {
      return buildLogEvent({
        ...base,
        operation: 'agent.run',
        userId: event.userId,
        correlationId: event.runId,
        nowMs: event.durationMs,
        outcome: event.status === 'failed' || event.status === 'interrupted' ? 'error' : 'success',
        error:
          event.status === 'failed' || event.status === 'interrupted'
            ? namedError(event.errorCode ?? event.status, event.errorCode ?? event.status)
            : undefined,
        subjectIds: { runId: event.runId, conversationId: event.conversationId },
        input: { status: event.status, errorCode: event.errorCode, ...event.consumed },
      });
    }
    return null;
  }
}
