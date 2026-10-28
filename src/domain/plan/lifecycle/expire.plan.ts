import { type Plan } from '../plan.ts';
import { movePlan } from './move.plan.ts';

/** `pending` vencido vira `expired`; qualquer outro estado (ou ainda valido) volta igual. */
export function expirePlan(plan: Plan, now: Date): Plan {
  if (plan.status !== 'pending' || now.toISOString() < plan.expiresAt) return plan;
  return movePlan(plan, 'expired', { decidedAt: now.toISOString() });
}
