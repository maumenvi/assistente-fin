import { type Consumed } from '../../../../domain/agent/consumed.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/** Consumo acumulado da execucao ate agora. */
export interface UsageEvent extends AgentEventBase {
  readonly type: 'usage';
  readonly consumed: Consumed;
}
