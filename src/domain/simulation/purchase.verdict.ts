import { type CalendarMonth } from './account.projection.ts';

/** Faixa do resultado da simulacao (FR-040). */
export type PurchaseVerdictLevel = 'ok' | 'not-recommended' | 'not-possible';

/**
 * Resultado da simulacao numa conta/cartao (o pior ponto encontrado): faixa, onde e quando, e
 * quanto sobra (negativo = no vermelho) diante da base da margem (FR-042).
 */
export interface PurchaseVerdict {
  readonly level: PurchaseVerdictLevel;
  readonly accountId: string;
  /** Mes do pior saldo (conta); `null` no cartao (o limite nao e mensal). */
  readonly month: CalendarMonth | null;
  readonly remainingCents: number;
  readonly baseCents: number;
}

/** Resultado sem e (havendo pre-registros) com os pre-registros pendentes (FR-043). */
export interface PurchaseViability {
  readonly withoutPending: PurchaseVerdict;
  readonly withPending?: PurchaseVerdict | undefined;
}
