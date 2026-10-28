import { type Plan } from '../plan.ts';
import { movePlan } from './move.plan.ts';

/** `pending -> approved`, aplicando a selecao final do usuario (itens fora dela ficam desmarcados). */
export function approvePlan(plan: Plan, selectedIds: readonly string[], now: Date): Plan {
  const chosen = new Set(selectedIds);
  const items = plan.items.map((i) => ({ ...i, selected: chosen.has(i.id) }));
  return movePlan(plan, 'approved', { items, decidedAt: now.toISOString() });
}
