import { type AgentEventBase } from './agent.event.base.ts';

/** Uma execucao comecou. */
export interface RunStartedEvent extends AgentEventBase {
  readonly type: 'run_started';
  readonly userMessageId: string;
  readonly assistantMessageId: string;
}
