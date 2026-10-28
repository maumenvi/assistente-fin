import { PlanInvalidOperationError } from '../../../../domain/plan/errors/plan.invalid.operation.error.ts';
import { type PlanItem } from '../../../../domain/plan/plan.item.ts';
import { operationOf } from '../operations/operation.registry.ts';
import { verifyPlan } from '../verify/verify.plan.ts';
import { operationContext } from './engine.helpers.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

/**
 * Refaz um item com campos editados pelo usuario na revisao: junta a entrada, reprepara pelo
 * adaptador e reverifica. O item editado vem marcado (o usuario acabou de decidir sobre ele).
 */
export async function prepareEditedItem(deps: PlanEngineDeps, userId: string, item: PlanItem, edits: Readonly<Record<string, unknown>>, userText: string): Promise<PlanItem> {
  const adapter = operationOf(item.kind);
  if (adapter === undefined) throw new PlanInvalidOperationError(item.kind);
  const ctx = operationContext(deps, userId);
  const prepared = await adapter.prepare({ ...item.input, ...edits }, ctx);
  if (!prepared.ok) throw new PlanInvalidOperationError(prepared.reason);
  const verified = await verifyPlan([{ id: item.id, kind: item.kind, prepared: prepared.value, confidence: 1, source: item.source }], {
    ...ctx, userText: `${userText} ${Object.values(edits).join(' ')}`, knownMoneyCents: new Set(typeof edits['amountCents'] === 'number' ? [edits['amountCents']] : []), deps: deps.toolDeps,
  });
  const rebuilt = verified.items[0];
  if (rebuilt === undefined) throw new PlanInvalidOperationError(verified.rejected[0]?.reason ?? 'item invalido');
  return { ...rebuilt, selected: true };
}
