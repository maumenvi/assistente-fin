import { type AgentEvent } from '../ports/events/agent.event.ts';
import { type AgentEventsPort } from '../ports/events/agent.events.port.ts';

/**
 * Barramento de uma execucao que para de publicar quando a sessao acaba (spec 031, T118): depois
 * de `isMuted()`, nenhum evento mais chega a UI do proximo usuario. Assinar continua passando.
 */
export class GatedAgentEvents implements AgentEventsPort {
  private readonly inner: AgentEventsPort;
  private readonly isMuted: () => boolean;

  public constructor(inner: AgentEventsPort, isMuted: () => boolean) {
    this.inner = inner;
    this.isMuted = isMuted;
  }

  public publish(event: AgentEvent): void {
    if (!this.isMuted()) this.inner.publish(event);
  }

  public subscribe(listener: (event: AgentEvent) => void): () => void {
    return this.inner.subscribe(listener);
  }
}
