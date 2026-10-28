/** Regra "comerciante -> categoria" aprendida ou dita; unica entidade desta spec que sincroniza (data-model.md 6). */
export interface CategorizationRule {
  readonly id: string;
  readonly userId: string;
  /** Descricao normalizada (`normalizeMerchant`). */
  readonly merchant: string;
  readonly categoryId: string;
  readonly origin: 'learned' | 'said';
  readonly confidence: number;
  readonly evidence: number;
  readonly createdAt: string;
  /** Versao do sync (ultima escrita vence). */
  readonly updatedAt: string;
}
