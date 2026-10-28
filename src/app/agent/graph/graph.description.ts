/** Um no do grafo como dado, para o visualizador e o Mermaid. */
export interface GraphDescriptionNode {
  readonly id: string;
  /** Rotulo em pt-BR (igual ao do diagrama). */
  readonly label: string;
  readonly isStart: boolean;
}

/** Uma aresta do grafo (`to` e `END` quando termina). */
export interface GraphDescriptionEdge {
  readonly from: string;
  readonly to: string;
}

/** O grafo descrito como dado puro (JSON). */
export interface GraphDescription {
  readonly nodes: readonly GraphDescriptionNode[];
  readonly edges: readonly GraphDescriptionEdge[];
}
