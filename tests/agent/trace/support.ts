import { type LogEvent } from '../../../src/domain/logging/log.event.ts';
import { type LogSink } from '../../../src/app/shared/log.sink.port.ts';
import { type AgentLogPort } from '../../../src/app/agent/ports/observe/agent.log.port.ts';
import { type TraceEvent } from '../../../src/app/agent/ports/observe/trace.event.ts';
import { makeStep } from '../store/support/agent.fixtures.ts';

/** `LogSink` que guarda os eventos. */
export class CollectingLogSink implements LogSink {
  public readonly events: LogEvent[] = [];

  public record(event: LogEvent): void {
    this.events.push(event);
  }
}

/** `AgentLogPort` que guarda as mensagens. */
export class CollectingAgentLog implements AgentLogPort {
  public readonly warns: { message: string; fields?: Readonly<Record<string, unknown>> | undefined }[] = [];
  public readonly errors: { message: string }[] = [];

  public warn(message: string, fields?: Readonly<Record<string, unknown>>): void {
    this.warns.push({ message, fields });
  }

  public error(message: string): void {
    this.errors.push({ message });
  }
}

/** Evento de passo para os testes de trace. */
export function stepEvent(runId: string, seq: number, userId = 'u1'): TraceEvent {
  return { type: 'step', userId, step: makeStep(runId, seq) };
}
