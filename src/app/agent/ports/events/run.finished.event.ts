import { type AgentEventBase } from './agent.event.base.ts';

/** A execucao terminou (ou foi interrompida). */
export interface RunFinishedEvent extends AgentEventBase {
  readonly type: 'run_finished';
  readonly status: 'done' | 'failed' | 'cancelled' | 'interrupted';
  readonly error?: { readonly code: string; readonly message: string };
}
