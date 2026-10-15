/**
 * Forma de pagamento de uma simulacao de compra (spec 001, RF-9).
 *
 * So descritiva - nao muda como o impacto e calculado (`calculatePurchaseImpact`); a spec
 * nao enumera valores especificos, esta lista cobre os meios comuns no Brasil.
 */
export const PAYMENT_METHODS = ['cash', 'debit-card', 'credit-card', 'pix'] as const;

/** Um dos valores de `PAYMENT_METHODS`. */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
