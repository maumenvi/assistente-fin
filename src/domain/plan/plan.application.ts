import { type TouchedRecord } from './touched.record.ts';

/** O que a aplicacao de um item gravou (uma por item aplicado). */
export interface PlanApplication {
  readonly itemId: string;
  readonly appliedAt: string;
  readonly touched: readonly TouchedRecord[];
  readonly revertedAt: string | null;
}
