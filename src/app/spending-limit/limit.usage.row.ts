import { type UsageStatus } from './usage.status.ts';

/** Uma linha de "quanto do limite ja foi usado" (Inicio e widget, FR-045 da 022). */
export interface LimitUsageRow {
  readonly id: string;
  readonly name: string;
  readonly kind: 'spending-limit' | 'credit-card';
  /** Percentual usado, inteiro (pode passar de 100). */
  readonly usedPercent: number;
  /** Cor da linha, pela regra unica (`usageStatus`). */
  readonly status: UsageStatus;
}
