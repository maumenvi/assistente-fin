/**
 * Distribui um valor total em N parcelas (originalmente spec 001, RF-9, CA-9; reaproveitada
 * pela spec 009, RF-3/CA-2): funcao pura, sobre centavos inteiros, sem dependencia de nenhum
 * conceito de simulacao ou de cartao - por isso mora em `domain/money`, neutro o bastante pra
 * ser usado tanto por `PurchaseSimulation` quanto por `RecordInstallmentPurchaseUseCase`.
 * Quando o valor nao divide exato, o resto (1 centavo por vez) vai nas primeiras parcelas - a
 * soma do plano bate sempre, exatamente, com `totalCents`.
 */
export function buildInstallmentPlan(totalCents: number, installments: number): number[] {
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error('installments deve ser um inteiro >= 1');
  }

  const base = Math.floor(totalCents / installments);
  const remainder = totalCents - base * installments;

  return Array.from({ length: installments }, (_, index) => base + (index < remainder ? 1 : 0));
}
