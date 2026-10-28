import { EMPTY_CONSUMED } from '../../../domain/agent/empty.consumed.ts';
import { type GraphDescription } from '../graph/graph.description.ts';
import { projectGraph } from './project.graph.ts';
import { type RunViewState } from './run.view.state.ts';

/** Tela de execucao ao vivo sem nenhum evento ainda: o grafo todo "nao visitado". */
export function emptyRunView(graph: GraphDescription, runId: string | null = null): RunViewState {
  return { runId, status: 'running', ...projectGraph(graph, [], null), steps: [], plans: [], currentNode: null, consumed: EMPTY_CONSUMED, errorCode: null, lastEventSeq: 0 };
}
