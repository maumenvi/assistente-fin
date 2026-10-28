import { runApproved } from './approve.plan.use.case.ts';
import { planLock } from './keyed.lock.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

/**
 * Recuperacao apos fechar o app no meio: plano `approved` sem aplicacao (a transacao e atomica, entao
 * nada foi gravado) segue para a revalidacao e a aplicacao, uma unica vez. Devolve quantos recuperou.
 */
export async function recoverPlans(deps: PlanEngineDeps, userId: string): Promise<number> {
  const leftovers = await deps.db.plans.plans.listApproved(userId);
  for (const plan of leftovers) {
    await planLock.run(plan.id, async () => {
      const current = await deps.db.plans.plans.get(userId, plan.id);
      if (current?.status === 'approved') await runApproved(deps, current);
    });
  }
  return leftovers.length;
}
