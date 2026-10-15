/** Contagens de um lote para o resumo e o historico (spec 029, FR-010). */
export interface AiBatchSummary {
  readonly created: number;
  readonly updated: number;
  readonly paid: number;
  readonly duplicates: number;
  readonly deleted: number;
  readonly rejected: number;
  readonly pendingDestructive: number;
}

export const EMPTY_AI_BATCH_SUMMARY: AiBatchSummary = {
  created: 0,
  updated: 0,
  paid: 0,
  duplicates: 0,
  deleted: 0,
  rejected: 0,
  pendingDestructive: 0,
};
