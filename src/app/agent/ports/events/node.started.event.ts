import { type AgentEventBase } from './agent.event.base.ts';

/** Um no do grafo comecou (alimenta o indicador de etapa e o diagrama ao vivo). */
export interface NodeStartedEvent extends AgentEventBase {
  readonly type: 'node_started';
  readonly node: string;
}
