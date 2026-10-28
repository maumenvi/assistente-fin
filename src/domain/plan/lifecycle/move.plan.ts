import { PlanAlreadyDecidedError } from '../errors/plan.already.decided.error.ts';
import { type Plan } from '../plan.ts';
import { type PlanStatus } from '../plan.status.ts';
import { canTransition } from './transition.ts';

/** Move o plano de estado, ou lanca se a transicao nao existe (data-model.md 1). */
export function movePlan(plan: Plan, to: PlanStatus, patch: Partial<Plan> = {}): Plan {
  if (!canTransition(plan.status, to)) throw new PlanAlreadyDecidedError(`${plan.status} -> ${to}`);
  return { ...plan, ...patch, status: to };
}
