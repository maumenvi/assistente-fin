import { END } from './end.ts';
import { type Graph } from './graph.ts';

/**
 * Valida e devolve a definicao de um grafo. Lanca `Error` claro se: o no inicial nao existe, uma
 * transicao aponta para um no inexistente, um no nao tem nenhuma saida, ou ha no inalcancavel a
 * partir do inicial. O fluxo inteiro vive num arquivo (`agent.graph.ts`) e e lido de cima a baixo.
 */
export function defineGraph<N extends string, State, Context>(graph: Graph<N, State, Context>): Graph<N, State, Context> {
  const names = Object.keys(graph.nodes) as N[];
  if (!names.includes(graph.start)) {
    throw new Error(`grafo invalido: no inicial "${graph.start}" nao existe`);
  }
  for (const name of names) {
    const node = graph.nodes[name];
    if (node.to.length === 0) throw new Error(`grafo invalido: o no "${name}" nao tem nenhuma saida`);
    for (const target of node.to) {
      if (target !== END && !names.includes(target as N)) {
        throw new Error(`grafo invalido: o no "${name}" aponta para "${target}", que nao existe`);
      }
    }
  }
  const reachable = new Set<string>([graph.start]);
  const queue: N[] = [graph.start];
  while (queue.length > 0) {
    const current = queue.shift() as N;
    for (const target of graph.nodes[current].to) {
      if (target !== END && !reachable.has(target)) {
        reachable.add(target);
        queue.push(target as N);
      }
    }
  }
  const orphans = names.filter((name) => !reachable.has(name));
  if (orphans.length > 0) throw new Error(`grafo invalido: nos inalcancaveis a partir de "${graph.start}": ${orphans.join(', ')}`);
  return graph;
}
