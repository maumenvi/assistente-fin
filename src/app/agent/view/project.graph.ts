import { type GraphDescription } from '../graph/graph.description.ts';
import { type RunViewState } from './run.view.state.ts';

/** Recalcula nos (visitas) e arestas (percorridas) a partir dos passos e da definicao do grafo. */
export function projectGraph(
  graph: GraphDescription,
  steps: readonly { readonly node: string; readonly toNode?: string | null; readonly fromNode?: string | null }[],
  currentNode: string | null,
): Pick<RunViewState, 'nodes' | 'edges'> {
  const visits = new Map<string, number>();
  const taken = new Map<string, number>();
  for (const step of steps) {
    visits.set(step.node, (visits.get(step.node) ?? 0) + 1);
    if (step.toNode !== undefined && step.toNode !== null) {
      const key = `${step.node}>${step.toNode}`;
      taken.set(key, (taken.get(key) ?? 0) + 1);
    }
  }
  return {
    nodes: graph.nodes.map((n) => ({ id: n.id, label: n.label, isStart: n.isStart, visits: visits.get(n.id) ?? 0, current: n.id === currentNode })),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, taken: taken.get(`${e.from}>${e.to}`) ?? 0 })),
  };
}
