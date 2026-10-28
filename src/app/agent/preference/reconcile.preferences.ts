import { supersedeConflicting, type Supersession } from '../../../domain/preference/lifecycle/supersede.conflicting.ts';
import { topicOverwriteId } from '../../../domain/preference/topic.overwrite.ts';
import { type PreferenceStoresPort } from '../ports/preference/preference.stores.port.ts';

/**
 * Reconciliacao de conflito por topico (spec 032, research P2): entre as preferencias `active` de
 * mesmo topico e escopo, a mais recente fica e as outras viram `disabled`. Cada substituida deixa um
 * aviso discreto com "Restaurar". Idempotente - chamar de novo nao muda nada - e roda ao salvar,
 * ao montar o contexto e depois de aplicar alteracoes vindas do sync.
 */
export async function reconcilePreferences(stores: PreferenceStoresPort, userId: string, now: Date): Promise<Supersession[]> {
  const active = await stores.preferences.list(userId, { status: ['active'] });
  const superseded = supersedeConflicting(active);
  const at = now.toISOString();
  for (const { loserId, winnerId } of superseded) {
    const loser = active.find((p) => p.id === loserId);
    if (loser === undefined) continue;
    await stores.overwrites.record({ id: topicOverwriteId(loserId), userId, preferenceId: winnerId, lostText: loser.text, lostAt: loser.updatedAt, seenAt: null });
    await stores.preferences.supersede(userId, loserId, winnerId, at);
  }
  return superseded;
}
