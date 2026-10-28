import { type Plan } from '../../../../domain/plan/plan.ts';
import { MIN_SELECT_CONFIDENCE } from '../../../../domain/plan/plan.settings.ts';

/** Quantos itens do plano estao na selecao. */
export function selectedCount(plan: Plan, selection: ReadonlySet<string>): number {
  return plan.items.filter((i) => selection.has(i.id)).length;
}

/** Marca/desmarca um item (devolve um conjunto novo). */
export function toggleItem(selection: ReadonlySet<string>, itemId: string): ReadonlySet<string> {
  const next = new Set(selection);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  return next;
}

export function selectAll(plan: Plan): ReadonlySet<string> {
  return new Set(plan.items.map((i) => i.id));
}

export function clearSelection(): ReadonlySet<string> {
  return new Set();
}

/** "So os confiaveis": confianca minima e nenhum alerta. */
export function selectReliable(plan: Plan): ReadonlySet<string> {
  return new Set(plan.items.filter((i) => i.confidence >= MIN_SELECT_CONFIDENCE && i.flags.length === 0).map((i) => i.id));
}
