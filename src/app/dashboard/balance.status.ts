/**
 * Limite padrao de saldo baixo do Dashboard, em centavos (spec 015, RF-2): R$ 400,00. Usado
 * quando `SessionUser.lowBalanceThresholdCents` e `null` (usuario nunca configurou).
 */
export const DEFAULT_LOW_BALANCE_THRESHOLD_CENTS = 40_000;

/** Estado visual do card "Saldo do mes" do Dashboard (spec 015, RF-1). */
export type BalanceStatus = 'ok' | 'warn' | 'danger';

/**
 * Calcula o estado do card "Saldo do mes" (spec 015, RF-1, CA correspondentes):
 * - `balanceCents <= 0` -> `'danger'` (vermelho).
 * - `0 < balanceCents < thresholdCents` -> `'warn'` (amarelo).
 * - `balanceCents >= thresholdCents` -> `'ok'` (verde).
 *
 * Funcao pura de apresentacao (nao e regra de dominio financeiro - por isso vive no renderer,
 * nao em `src/domain`).
 */
export function calculateBalanceStatus(balanceCents: number, thresholdCents: number): BalanceStatus {
  if (balanceCents <= 0) return 'danger';
  if (balanceCents < thresholdCents) return 'warn';
  return 'ok';
}
