import { PlanPolicyViolationError } from '../plan/errors/plan.policy.violation.error.ts';
import { UNDO_DAYS_RANGE, VALIDITY_HOURS_RANGE } from '../plan/plan.settings.ts';
import { type AutonomyPolicy } from './autonomy.policy.ts';

/** Garante limites positivos e validade/janela nos intervalos permitidos. */
export function validatePolicy(policy: AutonomyPolicy): AutonomyPolicy {
  for (const [key, rule] of Object.entries(policy.rules)) {
    if (!Number.isInteger(rule.maxAmountCents) || rule.maxAmountCents <= 0) throw new PlanPolicyViolationError(`${key}: valor maximo deve ser positivo`);
    if (!Number.isInteger(rule.maxItems) || rule.maxItems <= 0) throw new PlanPolicyViolationError(`${key}: itens por vez deve ser positivo`);
  }
  const { validityHours: v, undoDays: u } = policy;
  if (!Number.isInteger(v) || v < VALIDITY_HOURS_RANGE.min || v > VALIDITY_HOURS_RANGE.max) throw new PlanPolicyViolationError('validade fora de 1 a 168 horas');
  if (!Number.isInteger(u) || u < UNDO_DAYS_RANGE.min || u > UNDO_DAYS_RANGE.max) throw new PlanPolicyViolationError('janela de desfazer fora de 1 a 30 dias');
  return policy;
}
