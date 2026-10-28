import { rejectPlan as markRejected } from '../../../../domain/plan/lifecycle/reject.plan.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { loadPlan, savePlan } from './engine.helpers.ts';
import { planLock } from './keyed.lock.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

/** Recusar: o plano pendente vira `rejected` e nada e gravado. Fora de `pending`, volta como esta. */
export function rejectPlan(deps: PlanEngineDeps, userId: string, planId: string): Promise<Plan> {
  return planLock.run(planId, async () => {
    const plan = await loadPlan(deps, userId, planId);
    return plan.status === 'pending' ? savePlan(deps, markRejected(plan, deps.clock.now())) : plan;
  });
}
