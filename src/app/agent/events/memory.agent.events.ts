import { type AgentEvent } from '../ports/events/agent.event.ts';
import { type AgentEventsPort } from '../ports/events/agent.events.port.ts';

/** Barramento de eventos em memoria: `publish` sincrono, sem I/O; um ouvinte que lanca nao afeta os demais. */
export class MemoryAgentEvents implements AgentEventsPort {
  private readonly listeners = new Set<(event: AgentEvent) => void>();

  public publish(event: AgentEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // um ouvinte com defeito nao pode atrapalhar os outros nem o agente
      }
    }
  }

  public subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
