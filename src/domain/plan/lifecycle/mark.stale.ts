import { type Plan } from '../plan.ts';
import { movePlan } from './move.plan.ts';

/** Os dados mudaram depois da proposta: o plano nao pode mais ser aplicado. */
export function markStale(plan: Plan, now: Date): Plan {
  return movePlan(plan, 'stale', { decidedAt: now.toISOString() });
}
