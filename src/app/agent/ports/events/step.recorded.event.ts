import { type AgentEventBase } from './agent.event.base.ts';
import { type RunStepSummary } from './run.step.summary.ts';

/** Um passo terminou: alimenta a linha do tempo da tela de execucao ao vivo. */
export interface StepRecordedEvent extends AgentEventBase {
  readonly type: 'step_recorded';
  readonly step: RunStepSummary;
}
