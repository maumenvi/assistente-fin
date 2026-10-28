import { type Plan } from '../plan.ts';
import { movePlan } from './move.plan.ts';

export function rejectPlan(plan: Plan, now: Date): Plan {
  return movePlan(plan, 'rejected', { decidedAt: now.toISOString() });
}
