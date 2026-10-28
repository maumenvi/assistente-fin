import { type End } from './end.ts';
import { type GraphNode } from './graph.node.ts';
import { type NodeResult } from './node.result.ts';

/**
 * Declara um no de modo que o COMPILADOR recuse um `next` fora de `to`: o tipo `Targets` e
 * inferido da lista `to` e o resultado de `run` so pode apontar para ela. O runner confere de
 * novo em execucao (defesa em profundidade).
 */
export function defineNode<N extends string, State, Context, const Targets extends N | End>(node: {
  readonly to: readonly Targets[];
  readonly run: (state: State, ctx: Context) => Promise<NodeResult<Targets, State>>;
}): GraphNode<N, State, Context> {
  return node as unknown as GraphNode<N, State, Context>;
}
