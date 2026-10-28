import { type AgentEventBase } from './agent.event.base.ts';

/**
 * Sugestao de preferencia aprendida (spec 032, FR-005): aviso discreto sob a ultima resposta. Chega
 * DEPOIS de `run_finished`, com um `runId` proprio (`<run>:learn`), para a ordem da execucao nao
 * descarta-lo.
 */
export interface PreferenceSuggestedEvent extends AgentEventBase {
  readonly type: 'preference_suggested';
  readonly messageId: string;
  readonly preferenceId: string;
  readonly text: string;
}
