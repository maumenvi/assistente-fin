import { canRevert } from '../../../../domain/plan/lifecycle/can.revert.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanStatus } from '../../../../domain/plan/plan.status.ts';
import { planStatusText, type PlanTone } from './plan.card.view.ts';

export type HistoryFilter = 'all' | 'pending' | 'applied' | 'closed';

export const HISTORY_FILTERS: readonly { readonly id: HistoryFilter; readonly label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Aguardando' },
  { id: 'applied', label: 'Aplicados' },
  { id: 'closed', label: 'Encerrados' },
];

const GROUPS: Readonly<Record<Exclude<HistoryFilter, 'all'>, readonly PlanStatus[]>> = {
  pending: ['pending', 'approved'],
  applied: ['applied', 'partial'],
  closed: ['rejected', 'expired', 'stale', 'reverted'],
};

/** Estados que o filtro pede ao armazenamento (`undefined` = todos). */
export function statusesOf(filter: HistoryFilter): readonly PlanStatus[] | undefined {
  return filter === 'all' ? undefined : GROUPS[filter];
}

export interface PlanHistoryRow {
  readonly planId: string;
  readonly title: string;
  readonly statusText: string;
  readonly tone: PlanTone;
  /** "23/10 12:00" */
  readonly when: string;
  readonly itemsText: string;
  readonly origin: 'user' | 'policy';
  readonly canRevert: boolean;
}

const TONE: Readonly<Record<PlanStatus, PlanTone>> = {
  pending: 'warning', approved: 'neutral', applied: 'success', rejected: 'neutral', expired: 'neutral', stale: 'danger', reverted: 'neutral', partial: 'warning',
};

function whenText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Linhas do historico de planos (mais recentes primeiro, como o armazenamento entrega). */
export function buildPlanHistory(plans: readonly Plan[], now: Date): PlanHistoryRow[] {
  return plans.map((p) => {
    const selected = p.items.filter((i) => i.selected).length;
    return {
      planId: p.id,
      title: p.summary,
      statusText: planStatusText(p.status),
      tone: TONE[p.status],
      when: whenText(p.createdAt),
      itemsText: p.status === 'applied' || p.status === 'partial' || p.status === 'reverted' ? `${p.applications.length} de ${p.items.length} itens aplicados` : `${selected} de ${p.items.length} itens marcados`,
      origin: p.origin,
      canRevert: canRevert(p, now),
    };
  });
}

export const EMPTY_HISTORY_TEXT = 'Nenhum plano ainda. Peça ao assistente para lançar, editar ou classificar algo.';
