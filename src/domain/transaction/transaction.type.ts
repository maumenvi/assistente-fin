/**
 * Natureza de uma transacao manual (spec 001, RF-5).
 *
 * - `income`   entrada de dinheiro
 * - `expense`  saida de dinheiro
 */
export const TRANSACTION_TYPES = ['income', 'expense'] as const;

/** Um dos valores de `TRANSACTION_TYPES`. */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
