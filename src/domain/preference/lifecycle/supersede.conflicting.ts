import { type Preference } from '../preference.ts';

/** Uma preferencia substituida por outra mais recente. */
export interface Supersession {
  readonly loserId: string;
  readonly winnerId: string;
}

function groupKey(p: Preference): string {
  return `${p.topic}|${p.scope.kind}|${p.scope.kind === 'global' ? '' : p.scope.id}`;
}

function newer(a: Preference, b: Preference): Preference {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.id > b.id ? a : b;
}

/**
 * Conflito por topico (spec 032, research P2): entre as `active` do mesmo topico e escopo com
 * textos diferentes, a mais recente fica; as outras sao substituidas. `other:*` nunca conflita.
 * Idempotente: substituidas viram `disabled` e saem do grupo.
 */
export function supersedeConflicting(prefs: readonly Preference[]): Supersession[] {
  const groups = new Map<string, Preference[]>();
  for (const p of prefs) {
    if (p.status !== 'active' || p.topic.startsWith('other:')) continue;
    const list = groups.get(groupKey(p)) ?? [];
    list.push(p);
    groups.set(groupKey(p), list);
  }
  const out: Supersession[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const winner = list.reduce(newer);
    for (const p of list) {
      if (p.id !== winner.id && p.text.trim() !== winner.text.trim()) out.push({ loserId: p.id, winnerId: winner.id });
    }
  }
  return out;
}
