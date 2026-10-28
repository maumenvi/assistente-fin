import { markApplied } from '../../../../domain/plan/lifecycle/mark.applied.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanApplication } from '../../../../domain/plan/plan.application.ts';
import { applyItem } from './apply.item.ts';
import { loadPolicy, savePlan } from './engine.helpers.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

/**
 * Aplica os itens marcados numa UNICA transacao (tudo ou nada, spec 033 FR-006): cada item pelo
 * caso de uso da tela, ligado ao `tx`; o plano vira `applied` dentro da mesma transacao. Qualquer
 * erro desfaz tudo e o plano volta a `pending` com o motivo em `lastError`.
 */
export async function applyPlan(deps: PlanEngineDeps, plan: Plan, origin: 'user' | 'policy'): Promise<Plan> {
  const now = deps.clock.now();
  const policy = await loadPolicy(deps, plan.userId);
  try {
    const applied = await deps.db.transaction(async (tx) => {
      const writers = deps.writers(tx, deps.ids);
      const applications: PlanApplication[] = [];
      for (const item of plan.items.filter((i) => i.selected)) {
        applications.push(await applyItem(item, { userId: plan.userId, now, db: tx, writers }));
      }
      const done: Plan = { ...markApplied(plan, applications, policy.undoDays, now), origin };
      await tx.plans.plans.save(done);
      return done;
    });
    return await savePlan(deps, applied);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return savePlan(deps, { ...plan, status: 'pending', lastError: reason, decidedAt: null });
  }
}
