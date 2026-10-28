import { type PlanApplication } from '../../../../domain/plan/plan.application.ts';
import { fingerprint } from '../../../../domain/plan/lifecycle/fingerprint.ts';
import { type Database } from '../../../shared/database.port.ts';
import { SYNC_CODECS } from '../../../sync/sync.record.codec.ts';
import { readSnapshot, restoreSnapshot } from '../operations/touch.snapshot.ts';

export type RevertOutcome =
  | { readonly status: 'reverted'; readonly application: PlanApplication; readonly kept: readonly string[] }
  | { readonly status: 'skipped'; readonly application: PlanApplication; readonly reason: 'edited_since' };

/** Categoria criada nao e excluida pelo app: o desfazer a mantem (sem uso) e informa. */
function cannotRemove(entity: keyof typeof SYNC_CODECS): boolean {
  return SYNC_CODECS[entity].remove === undefined;
}

/**
 * Desfaz a aplicacao de um item (spec 033, contracts/plan.engine.md): so se todo registro tocado
 * ainda esta como a aplicacao o deixou; se algum foi editado depois, o item inteiro e pulado.
 * Roda dentro de uma transacao do chamador.
 */
export async function revertApplication(application: PlanApplication, db: Database, userId: string, now: Date): Promise<RevertOutcome> {
  for (const t of application.touched) {
    if (t.before === null && cannotRemove(t.entity)) continue;
    const current = await readSnapshot(db, userId, t);
    if (fingerprint([current]) !== fingerprint([t.after])) return { status: 'skipped', application, reason: 'edited_since' };
  }
  const kept: string[] = [];
  for (const t of [...application.touched].reverse()) {
    if (t.before === null && cannotRemove(t.entity)) {
      kept.push(`${t.entity}:${t.id}`);
      continue;
    }
    await restoreSnapshot(db, userId, t, t.before);
  }
  return { status: 'reverted', application: { ...application, revertedAt: now.toISOString() }, kept };
}
