import { type End } from './end.ts';
import { type NodeResult } from './node.result.ts';

/** Um no do grafo: a funcao que executa e as transicoes que pode devolver (`to`). */
export interface GraphNode<N extends string, State, Context> {
  readonly run: (state: State, ctx: Context) => Promise<NodeResult<N, State>>;
  readonly to: readonly (N | End)[];
}
