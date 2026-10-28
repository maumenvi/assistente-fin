import { type AgentEventBase } from './agent.event.base.ts';

/** Um no do grafo terminou e o runner escolheu o proximo. */
export interface NodeFinishedEvent extends AgentEventBase {
  readonly type: 'node_finished';
  readonly node: string;
  readonly next: string;
  readonly durationMs: number;
}
