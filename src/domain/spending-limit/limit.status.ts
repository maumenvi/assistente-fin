import { Money } from '../shared/money.value.object.ts';

/** Situacao de um limite de gasto frente ao quanto ja foi gasto (spec 001, CA-4). */
export type LimitStatus = 'ok' | 'at-risk' | 'exceeded';

/**
 * Fracao de `maxAmount` a partir da qual o limite vira `at-risk` (spec, questao em aberto -
 * nao ha um numero fixado na spec/plan; 80% e um padrao comum de alerta de orcamento e fica
 * ajustavel aqui sem tocar em quem chama esta funcao).
 */
const AT_RISK_THRESHOLD = 0.8;

/**
 * Calcula o status de um limite de gasto (RF-4, CA-4): funcao pura, sem I/O - recebe
 * `spentAmount` ja somado pelo chamador (viria de `Transaction`, fora do escopo desta
 * entidade/fase).
 *
 * - `exceeded`  gasto > limite
 * - `at-risk`   gasto >= `AT_RISK_THRESHOLD` do limite (mas nao ultrapassou)
 * - `ok`        abaixo disso
 */
export function calculateLimitStatus(maxAmount: Money, spentAmount: Money): LimitStatus {
  if (spentAmount.compare(maxAmount) > 0) {
    return 'exceeded';
  }
  if (spentAmount.compare(maxAmount.multiply(AT_RISK_THRESHOLD)) >= 0) {
    return 'at-risk';
  }
  return 'ok';
}
