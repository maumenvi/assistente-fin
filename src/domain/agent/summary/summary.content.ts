/** Entidade citada no resumo, sempre por identificador (spec 032, FR-015). */
export interface SummaryEntity {
  readonly kind: 'account' | 'category' | 'card' | 'period';
  readonly id: string;
  readonly label: string;
}

/**
 * Conteudo estruturado do resumo de uma conversa (spec 032, data-model.md 1). NUNCA guarda
 * valores monetarios: o agente reconsulta quando precisa (FR-016).
 */
export interface SummaryContent {
  readonly goal: string;
  readonly decisions: readonly string[];
  readonly entities: readonly SummaryEntity[];
  readonly pending: readonly string[];
  readonly openPlans: readonly string[];
}
