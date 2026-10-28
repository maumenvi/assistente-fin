/** Entidade do usuario citavel numa preferencia de escopo conta ou categoria. */
export interface NamedEntity {
  readonly id: string;
  readonly name: string;
}

/** O que a selecao de preferencias enxerga do momento da conversa (spec 032, FR-012). */
export interface SelectContext {
  /** Pedido atual do usuario. */
  readonly userText: string;
  /** Textos da rodada em curso e do historico recente, em ordem cronologica. */
  readonly history: readonly string[];
  readonly accounts: readonly NamedEntity[];
  readonly categories: readonly NamedEntity[];
}
