import { PlanInvalidOperationError } from '../../../../domain/plan/errors/plan.invalid.operation.error.ts';
import { type PlanApplication } from '../../../../domain/plan/plan.application.ts';
import { type PlanItem } from '../../../../domain/plan/plan.item.ts';
import { type RecordSnapshot } from '../../../../domain/plan/touched.record.ts';
import { type ApplyContext } from '../operations/operation.context.ts';
import { operationOf } from '../operations/operation.registry.ts';
import { captureTouched, readSnapshot } from '../operations/touch.snapshot.ts';
import { refKey, type WatchRef } from '../operations/watch.ref.ts';

/**
 * Aplica um item pelo caso de uso da operacao e registra o que foi tocado (antes/depois de cada
 * registro), que torna o desfazer generico. Roda dentro da transacao da aplicacao do plano.
 */
export async function applyItem(item: PlanItem, ctx: ApplyContext): Promise<PlanApplication> {
  const adapter = operationOf(item.kind);
  if (adapter === undefined) throw new PlanInvalidOperationError(item.kind);
  const watched = await adapter.watch(item.input, ctx);
  const before = new Map<string, RecordSnapshot | null>();
  for (const ref of watched) before.set(refKey(ref), await readSnapshot(ctx.db, ctx.userId, ref));
  const created = await adapter.apply(item.input, ctx);
  const unique = new Map<string, WatchRef>();
  for (const ref of [...watched, ...created]) unique.set(refKey(ref), ref);
  const touched = await captureTouched(ctx.db, ctx.userId, [...unique.values()], before, refKey);
  return { itemId: item.id, appliedAt: ctx.now.toISOString(), touched, revertedAt: null };
}
