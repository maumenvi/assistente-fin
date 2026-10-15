/**
 * Nome da categoria de sistema de pagamento de fatura de cartao de credito, criada
 * automaticamente sob demanda (spec 016, RF-2).
 *
 * Ja esta na forma normalizada de `CategoryName`. O usuario pode renomear essa categoria - o
 * que a identifica e a flag `isSystemCardPayment`, nao o nome; por isso nada no sistema deve
 * comparar por esta constante para decidir se uma categoria e a de pagamento de fatura.
 */
export const CARD_PAYMENT_CATEGORY_NAME = 'PAGAMENTO DE FATURA';
