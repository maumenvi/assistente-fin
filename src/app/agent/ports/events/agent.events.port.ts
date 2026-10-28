import { type AgentEvent } from './agent.event.ts';

/** Barramento de eventos em memoria. `publish` e sincrono e sem I/O; o ouvinte que lanca nao afeta os demais. */
export interface AgentEventsPort {
  publish(event: AgentEvent): void;
  /** Devolve a funcao que cancela a assinatura. */
  subscribe(listener: (event: AgentEvent) => void): () => void;
}
