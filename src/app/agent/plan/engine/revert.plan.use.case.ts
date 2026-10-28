import { PlanNotRevertibleError } from '../../../../domain/plan/errors/plan.not.revertible.error.ts';
import { canRevert } from '../../../../domain/plan/lifecycle/can.revert.ts';
import { markReverted } from '../../../../domain/plan/lifecycle/mark.reverted.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { loadPlan, savePlan } from './engine.helpers.ts';
import { planLock } from './keyed.lock.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';
import { revertApplication } from './revert.touched.ts';

export interface RevertPlanResult {
  readonly plan: Plan;
  readonly reverted: readonly string[];
  readonly skipped: readonly { readonly itemId: string; readonly reason: 'edited_since' }[];
  /** Registros que o desfazer manteve (ex.: categoria criada, que o app nao exclui). */
  readonly kept: readonly string[];
}

/**
 * Desfazer o plano aplicado (inteiro ou so alguns itens) dentro da janela. Em ordem inversa e numa
 * transacao: item cujo registro foi editado depois e pulado e informado, nunca sobrescrito.
 */
export function revertPlan(deps: PlanEngineDeps, input: { userId: string; planId: string; itemIds?: readonly string[] | undefined }): Promise<RevertPlanResult> {
  return planLock.run(input.planId, async () => {
    const plan = await loadPlan(deps, input.userId, input.planId);
    const now = deps.clock.now();
    if (!canRevert(plan, now)) throw new PlanNotRevertibleError(plan.status === 'applied' || plan.status === 'partial' ? 'a janela do desfazer terminou' : `plano ${plan.status}`);
    const wanted = new Set(input.itemIds ?? plan.applications.map((a) => a.itemId));
    const reverted: string[] = [];
    const skipped: { itemId: string; reason: 'edited_since' }[] = [];
    const kept: string[] = [];
    const applications = await deps.db.transaction(async (tx) => {
      const out = [];
      for (const application of [...plan.applications].reverse()) {
        if (application.revertedAt !== null || !wanted.has(application.itemId)) {
          out.push(application);
          continue;
        }
        const result = await revertApplication(application, tx, input.userId, now);
        if (result.status === 'reverted') {
          reverted.push(application.itemId);
          kept.push(...result.kept);
        } else skipped.push({ itemId: application.itemId, reason: result.reason });
        out.push(result.application);
      }
      return out.reverse();
    });
    if (reverted.length === 0) return { plan, reverted, skipped, kept };
    return { plan: await savePlan(deps, markReverted(plan, applications, now)), reverted, skipped, kept };
  });
}
