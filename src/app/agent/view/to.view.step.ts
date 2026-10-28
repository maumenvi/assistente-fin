import { type RunStep } from '../../../domain/agent/run.step.ts';
import { NODE_LABELS } from '../graph/node.labels.ts';
import { type ViewStep } from './view.step.ts';

/** Passo gravado -> passo da tela. */
export function toViewStep(step: RunStep): ViewStep {
  return {
    seq: step.seq,
    node: step.node,
    label: NODE_LABELS[step.node] ?? step.node,
    status: step.status,
    durationMs: step.durationMs,
    model: step.model,
    inputTokens: step.inputTokens,
    outputTokens: step.outputTokens,
    costMicroUsd: step.costMicroUsd,
    toolNames: step.toolCalls.map((c) => c.name),
    toolCalls: step.toolCalls,
    request: step.request,
    response: step.response,
    truncated: step.truncated,
    error: step.error,
  };
}
