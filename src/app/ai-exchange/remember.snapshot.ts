import { MAX_REMEMBERED_SNAPSHOTS, type AiExchangePreferences } from './ai.exchange.preferences.ts';

/** Guarda a copia entregue ao agente (so as mais recentes), base do fallback do desatualizado (spec 029, R5, C1). */
export function rememberSnapshot(
  preferences: AiExchangePreferences,
  snapshot: { readonly id: string; readonly at: string },
): AiExchangePreferences {
  const others = preferences.snapshots.filter((item) => item.id !== snapshot.id);
  return { ...preferences, snapshots: [...others, { id: snapshot.id, at: snapshot.at }].slice(-MAX_REMEMBERED_SNAPSHOTS) };
}

/** Quando a copia `snapshotId` foi entregue, ou `null` se o app nao a conhece mais. */
export function findSnapshotAt(snapshots: readonly { readonly id: string; readonly at: string }[], snapshotId: string | undefined): string | null {
  if (snapshotId === undefined) return null;
  return snapshots.find((item) => item.id === snapshotId)?.at ?? null;
}
