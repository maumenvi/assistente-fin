import { EMPTY_CONSUMED } from '../../../domain/agent/empty.consumed.ts';
import { type AgentState } from './agent.state.ts';

/** Estado de uma execucao recem-criada. */
export function initialAgentState(runId: string): AgentState {
  return {
    runId,
    intent: null,
    pendingToolCalls: [],
    turnMessages: [],
    ledger: [],
    summaries: [],
    notices: [],
    finalText: null,
    appliedPreferenceIds: [],
    planIds: [],
    capabilityRequestIds: [],
    reports: [],
    counters: { llmCalls: 0, toolCalls: 0, correctionAttempts: 0, argRepairAttempts: 0 },
    usage: EMPTY_CONSUMED,
  };
}
