import { expirePlan } from '../../../../domain/plan/lifecycle/expire.plan.ts';
import { savePlan } from './engine.helpers.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

/** Marca como `expired` os planos pendentes vencidos; devolve quantos mudaram. */
export async function expirePlans(deps: PlanEngineDeps, userId: string): Promise<number> {
  const now = deps.clock.now();
  const overdue = await deps.db.plans.plans.listPendingExpired(userId, now.toISOString());
  for (const plan of overdue) await savePlan(deps, expirePlan(plan, now));
  return overdue.length;
}
