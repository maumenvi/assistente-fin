import { type GraphNode } from './graph.node.ts';

/** Motivo de o orcamento de uma execucao ter estourado (spec 031, spec 038 FR-008). */
export type LimitReason = 'steps' | 'time' | 'cost' | 'tokens';

/**
 * Grafo do agente declarado como dado (spec 031, D8): no inicial, nos e transicoes. `onLimit`,
 * quando existe, monta a resposta parcial quando o orcamento estoura (FR-017).
 */
export interface Graph<N extends string, State, Context> {
  readonly start: N;
  readonly nodes: Readonly<Record<N, GraphNode<N, State, Context>>>;
  readonly onLimit?: (state: State, which: LimitReason, ctx: Context) => Promise<State>;
}
