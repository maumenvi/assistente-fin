import { EMPTY_CONSUMED } from '../../../domain/agent/empty.consumed.ts';
import { type AgentRun } from '../../../domain/agent/agent.run.ts';
import { type RunStep } from '../../../domain/agent/run.step.ts';
import { type RunPlanRef } from '../use-cases/get.run.detail.use.case.ts';
import { type GraphDescription } from '../graph/graph.description.ts';
import { projectGraph } from './project.graph.ts';
import { toViewStep } from './to.view.step.ts';
import { type RunViewState } from './run.view.state.ts';

/**
 * Tela de uma execucao a partir do historico (run + passos gravados) e da definicao do grafo:
 * visitados, contagem por no e arestas percorridas. Nos nao visitados vem do grafo.
 */
export function buildRunView(run: Pick<AgentRun, 'id' | 'status' | 'consumed' | 'errorCode'>, steps: readonly RunStep[], graph: GraphDescription, plans: readonly RunPlanRef[] = []): RunViewState {
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);
  return {
    runId: run.id,
    status: run.status,
    ...projectGraph(graph, ordered, null),
    steps: ordered.map(toViewStep),
    plans,
    currentNode: null,
    consumed: run.consumed ?? EMPTY_CONSUMED,
    errorCode: run.errorCode,
    lastEventSeq: 0,
  };
}
