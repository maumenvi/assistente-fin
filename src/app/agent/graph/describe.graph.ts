import { END } from './end.ts';
import { type Graph } from './graph.ts';
import { type GraphDescription } from './graph.description.ts';

/**
 * Descreve um grafo como dado (nos com rotulo e arestas), na ordem em que foi declarado. Lanca
 * `Error` se algum no nao tiver rotulo: o diagrama e a tela de execucao nunca mostram um id cru.
 */
export function describeGraph<N extends string, State, Context>(
  graph: Graph<N, State, Context>,
  labels: Readonly<Record<string, string>>,
): GraphDescription {
  const ids = Object.keys(graph.nodes) as N[];
  const missing = ids.filter((id) => labels[id] === undefined);
  if (missing.length > 0) throw new Error(`nos sem rotulo: ${missing.join(', ')}`);
  return {
    nodes: ids.map((id) => ({ id, label: labels[id] as string, isStart: id === graph.start })),
    edges: ids.flatMap((from) => graph.nodes[from].to.map((to) => ({ from, to: to === END ? END : to }))),
  };
}
