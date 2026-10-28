/**
 * Sugestao de regra "comerciante -> categoria" mostrada no cartao do plano depois de o usuario aprovar
 * a mesma categorizacao duas vezes (spec 033, FR-024). `state` acompanha a decisao.
 */
export interface RuleSuggestion {
  readonly merchant: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly state: 'open' | 'accepted' | 'dismissed';
}
