import { NODE_LABELS } from '../graph/node.labels.ts';
import { type AgentEvent } from '../ports/events/agent.event.ts';
import { type RunStepSummary } from '../ports/events/run.step.summary.ts';
import { type RunViewState } from './run.view.state.ts';
import { type ViewStep } from './view.step.ts';

function summaryToStep(summary: RunStepSummary): ViewStep {
  return {
    seq: summary.seq,
    node: summary.node,
    label: NODE_LABELS[summary.node] ?? summary.node,
    status: summary.status,
    durationMs: summary.durationMs,
    model: summary.model,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    costMicroUsd: summary.costMicroUsd,
    toolNames: summary.toolNames,
    toolCalls: [],
    request: null,
    response: null,
    truncated: false,
    error: null,
  };
}

/**
 * Aplica um evento ao vivo na tela de execucao (puro). A definicao do grafo ja esta em `state`;
 * so os passos e a contagem mudam. Evento de outra execucao, repetido ou atrasado e ignorado.
 */
export function reduceRun(state: RunViewState, event: AgentEvent): RunViewState {
  if (state.runId !== null && event.runId !== state.runId) return state;
  if (event.seq !== 0 && event.seq <= state.lastEventSeq) return state;
  const base: RunViewState = { ...state, runId: state.runId ?? event.runId, lastEventSeq: Math.max(state.lastEventSeq, event.seq) };
  switch (event.type) {
    case 'run_started':
      return { ...base, status: 'running' };
    case 'node_started':
      return { ...base, currentNode: event.node, nodes: base.nodes.map((n) => ({ ...n, current: n.id === event.node })) };
    case 'step_recorded': {
      if (base.steps.some((s) => s.seq === event.step.seq)) return base;
      return {
        ...base,
        steps: [...base.steps, summaryToStep(event.step)].sort((a, b) => a.seq - b.seq),
        nodes: base.nodes.map((n) => (n.id === event.step.node ? { ...n, visits: n.visits + 1 } : n)),
      };
    }
    case 'node_finished':
      return {
        ...base,
        currentNode: null,
        nodes: base.nodes.map((n) => ({ ...n, current: false })),
        edges: base.edges.map((e) => (e.from === event.node && e.to === event.next ? { ...e, taken: e.taken + 1 } : e)),
      };
    case 'usage':
      return { ...base, consumed: event.consumed };
    case 'run_finished':
      return { ...base, status: event.status, currentNode: null, errorCode: event.error?.code ?? null };
    default:
      return base;
  }
}
