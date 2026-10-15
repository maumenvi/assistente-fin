/** Resumo de um conflito de sincronizacao para o sino (spec 022, FR-012/FR-029). */
export interface PendingConflictSummary {
  readonly id: string;
  readonly entityLabel: string;
  readonly detectedAt: Date;
}

/**
 * De onde vem a lista de conflitos de sincronizacao (so o celular pareado tem; no desktop e no
 * modo independente, nenhuma fonte e injetada).
 */
export interface PendingConflictSource {
  listByUser(userId: string): Promise<PendingConflictSummary[]>;
}
