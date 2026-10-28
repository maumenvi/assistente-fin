import { PlanAlreadyDecidedError } from '../../../../domain/plan/errors/plan.already.decided.error.ts';
import { PlanInvalidOperationError } from '../../../../domain/plan/errors/plan.invalid.operation.error.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { loadPlan, savePlan } from './engine.helpers.ts';
import { planLock } from './keyed.lock.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';
import { prepareEditedItem } from './prepare.edited.item.ts';

/** Ajuste manual na revisao: refaz um item do plano pendente com as edicoes e o reverifica. */
export function adjustPlan(deps: PlanEngineDeps, input: { userId: string; planId: string; itemId: string; edits: Readonly<Record<string, unknown>> }): Promise<Plan> {
  return planLock.run(input.planId, async () => {
    const plan = await loadPlan(deps, input.userId, input.planId);
    if (plan.status !== 'pending') throw new PlanAlreadyDecidedError(plan.status);
    const index = plan.items.findIndex((i) => i.id === input.itemId);
    const current = plan.items[index];
    if (current === undefined) throw new PlanInvalidOperationError(`item ${input.itemId} nao existe no plano`);
    const items = [...plan.items];
    items[index] = await prepareEditedItem(deps, input.userId, current, input.edits, plan.userText);
    return savePlan(deps, { ...plan, items });
  });
}
