import { canRevert } from '../../../../domain/plan/lifecycle/can.revert.ts';
import { type RuleSuggestion } from '../../../../domain/plan/rule/rule.suggestion.ts';
import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanStatus } from '../../../../domain/plan/plan.status.ts';
import { editableFields, type EditableField } from './plan.item.edit.ts';
import { selectedCount } from './plan.selection.ts';

export type PlanTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface PlanItemView {
  readonly id: string;
  readonly label: string;
  readonly before: readonly string[] | null;
  readonly after: readonly string[];
  readonly flags: readonly { readonly flag: PlanFlag['flag']; readonly title: string; readonly detail: string }[];
  readonly selected: boolean;
  /** So o plano pendente permite marcar/desmarcar e editar. */
  readonly editable: boolean;
  /** Item que a aplicacao pulou ao desfazer (editado depois) ou ja desfeito. */
  readonly reverted: boolean;
  readonly source: 'model' | 'rule';
  /** Campos que a revisao deixa editar (vazio fora do plano pendente). */
  readonly fields: readonly EditableField[];
}

export interface PlanCardView {
  readonly planId: string;
  readonly title: string;
  readonly status: PlanStatus;
  readonly statusText: string;
  readonly tone: PlanTone;
  readonly items: readonly PlanItemView[];
  readonly selectedCount: number;
  readonly approveLabel: string;
  readonly canApprove: boolean;
  readonly canReject: boolean;
  readonly canRevert: boolean;
  readonly revertLabel: string | null;
  /** "Vale até 24/10 12:00" enquanto pendente; "Desfazer até 30/10" depois de aplicado. */
  readonly deadlineText: string | null;
  readonly autoNote: string | null;
  /** Itens vindos de um anexo (spec 036): pede conferencia antes de aprovar. */
  readonly attachmentNote: string | null;
  readonly errorText: string | null;
  /** Ha alerta em algum item (a UI destaca o cartao). */
  readonly hasAlerts: boolean;
  /** Regras sugeridas ainda sem resposta ("Notei que ... Criar regra?"). */
  readonly ruleSuggestions: readonly RuleSuggestion[];
}

const STATUS_TEXT: Readonly<Record<PlanStatus, { text: string; tone: PlanTone }>> = {
  pending: { text: 'Aguardando sua aprovação', tone: 'warning' },
  approved: { text: 'Aplicando…', tone: 'neutral' },
  applied: { text: 'Aplicado', tone: 'success' },
  rejected: { text: 'Recusado', tone: 'neutral' },
  expired: { text: 'Venceu sem resposta', tone: 'neutral' },
  stale: { text: 'Os dados mudaram; peça de novo', tone: 'danger' },
  reverted: { text: 'Desfeito', tone: 'neutral' },
  partial: { text: 'Desfeito em parte', tone: 'warning' },
};

/** Texto curto do estado do plano (detalhe da execucao e historico). */
export function planStatusText(status: PlanStatus): string {
  return STATUS_TEXT[status].text;
}

const FLAG_TITLE: Readonly<Record<PlanFlag['flag'], string>> = {
  duplicate: 'Possível duplicado',
  diverges: 'Difere do que você pediu',
  low_confidence: 'Interpretação incerta',
  limit_impact: 'Passa do limite',
  missing_info: 'Falta informação',
};

/** "24/10 12:00" no fuso do aparelho. */
function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function shortDay(iso: string): string {
  return shortWhen(iso).slice(0, 5);
}

/** Estado do cartao do plano (puro): textos, botoes e o que cada item mostra, para desktop e celular. */
export function buildPlanCardView(plan: Plan, now: Date, selection?: ReadonlySet<string>): PlanCardView {
  const pending = plan.status === 'pending';
  const chosen = selection ?? new Set(plan.items.filter((i) => i.selected).map((i) => i.id));
  const revertedItems = new Set(plan.applications.filter((a) => a.revertedAt !== null).map((a) => a.itemId));
  const items: PlanItemView[] = plan.items.map((item) => ({
    id: item.id,
    label: item.label,
    before: item.before,
    after: item.after,
    flags: item.flags.map((f) => ({ flag: f.flag, title: FLAG_TITLE[f.flag], detail: f.text })),
    selected: pending ? chosen.has(item.id) : item.selected,
    editable: pending,
    reverted: revertedItems.has(item.id),
    source: item.source,
    fields: pending ? editableFields(item.input) : [],
  }));
  const count = pending ? selectedCount(plan, chosen) : items.filter((i) => i.selected).length;
  const status = STATUS_TEXT[plan.status];
  const revertible = canRevert(plan, now);
  const deadlineText = pending
    ? `Vale até ${shortWhen(plan.expiresAt)}`
    : revertible && plan.revertUntil !== null
      ? `Desfazer até ${shortDay(plan.revertUntil)}`
      : plan.status === 'applied' || plan.status === 'partial'
        ? 'O prazo para desfazer terminou'
        : null;
  return {
    planId: plan.id,
    title: plan.summary,
    status: plan.status,
    statusText: status.text,
    tone: status.tone,
    items,
    selectedCount: count,
    approveLabel: count === 0 ? 'Aprovar' : `Aprovar (${count})`,
    canApprove: pending && count > 0,
    canReject: pending,
    canRevert: revertible,
    revertLabel: revertible ? 'Desfazer' : null,
    deadlineText,
    attachmentNote: plan.status === 'pending' && plan.items.some((i) => i.origin === 'attachment') ? 'Estes itens vêm de um anexo. Confira cada um antes de aprovar; nada é gravado até você aprovar.' : null,
    autoNote: plan.origin === 'policy' && plan.status !== 'pending' ? 'Apliquei automaticamente, como você liberou.' : null,
    errorText: plan.lastError === null ? null : `Não consegui aplicar: ${plan.lastError}`,
    hasAlerts: plan.items.some((i) => i.flags.length > 0),
    ruleSuggestions: (plan.ruleSuggestions ?? []).filter((s) => s.state === 'open'),
  };
}
