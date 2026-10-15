import { type CalendarMonth } from './account.projection.ts';
import { type PurchaseVerdict, type PurchaseVerdictLevel } from './purchase.verdict.ts';

/** Veredito sem nenhum valor (app bloqueado). */
export interface RedactedVerdict {
  readonly level: PurchaseVerdictLevel;
  readonly accountId: string;
  readonly month: CalendarMonth | null;
}

/**
 * Simulacao aberta pelo widget com o app bloqueado (spec 022, FR-047): mostra so a faixa e o
 * mes/conta afetados - sem saldo, limite ou sobra.
 */
export function redactVerdictForLocked(verdict: PurchaseVerdict): RedactedVerdict {
  return { level: verdict.level, accountId: verdict.accountId, month: verdict.month };
}
