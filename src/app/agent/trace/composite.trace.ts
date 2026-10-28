import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';
import { type TraceEvent } from '../ports/observe/trace.event.ts';
import { emitSafely } from './emit.safely.ts';

/** Entrega cada evento a varios destinos (armazenamento local + `LogSink` da spec 017); um que falha nao afeta os outros. */
export class CompositeTrace implements AgentTracePort {
  private readonly targets: readonly AgentTracePort[];

  public constructor(targets: readonly AgentTracePort[]) {
    this.targets = targets;
  }

  public emit(event: TraceEvent): void {
    for (const target of this.targets) emitSafely(target, event);
  }

  public async flush(deadlineMs: number): Promise<void> {
    await Promise.allSettled(this.targets.map((target) => target.flush(deadlineMs)));
  }
}
