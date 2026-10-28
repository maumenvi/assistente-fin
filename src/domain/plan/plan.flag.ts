export const PLAN_FLAG_KINDS = ['duplicate', 'diverges', 'low_confidence', 'limit_impact', 'missing_info'] as const;

/** Alerta da verificacao num item; `ref` e o id do registro existente (duplicata). */
export interface PlanFlag {
  readonly flag: (typeof PLAN_FLAG_KINDS)[number];
  readonly text: string;
  readonly ref?: string;
}
