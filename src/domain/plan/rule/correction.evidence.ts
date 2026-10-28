/** Correcao de categoria aprovada pelo usuario; 2 iguais em 90 dias sugerem uma regra. Local. */
export interface CorrectionEvidence {
  readonly userId: string;
  readonly merchant: string;
  readonly categoryId: string;
  readonly at: string;
  readonly planId: string;
}
