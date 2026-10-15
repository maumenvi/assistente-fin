/** Mes de calendario simples (1-12). */
export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

/** Saldo previsto de uma conta no fim de um mes. */
export interface MonthlyBalance extends CalendarMonth {
  readonly cents: number;
}

/**
 * Situacao de uma conta ou cartao para a simulacao (spec 022, FR-040). Conta: saldo previsto no
 * fim de cada mes do horizonte; base da margem = saldo de hoje. Cartao: limite disponivel; base
 * da margem = limite total.
 */
export type AccountProjection =
  | {
      readonly id: string;
      readonly kind: 'account';
      readonly baseCents: number;
      readonly monthlyBalances: readonly MonthlyBalance[];
    }
  | { readonly id: string; readonly kind: 'card'; readonly baseCents: number; readonly availableCents: number };
