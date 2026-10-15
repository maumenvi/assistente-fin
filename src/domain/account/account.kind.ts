/**
 * Natureza de uma conta financeira.
 *
 * - `checking`     conta corrente
 * - `savings`      poupanca
 * - `wallet`       carteira / dinheiro em especie
 * - `credit-card`  cartao de credito
 * - `meal-voucher`  cartao de alimentacao
 * - `other`        qualquer outra (investimento, vale, etc.)
 */
export const ACCOUNT_KINDS = ['checking', 'savings', 'wallet', 'credit-card', 'meal-voucher', 'other'] as const;

/** Um dos valores de `ACCOUNT_KINDS`. */
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
