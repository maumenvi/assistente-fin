import { type AutonomyPolicy } from '../../../../domain/autonomy/autonomy.policy.ts';
import { type AutoActionKey } from '../../../../domain/plan/auto.action.key.ts';
import { UNDO_DAYS_RANGE, VALIDITY_HOURS_RANGE } from '../../../../domain/plan/plan.settings.ts';
import { formatBrl } from '../../verify/format.brl.ts';
import { parseBrlToCents } from '../../verify/parse.brl.ts';

export interface AutonomyRowForm {
  readonly key: AutoActionKey;
  readonly label: string;
  readonly enabled: boolean;
  /** Valor maximo por item, em reais pt-BR ("200,00"). */
  readonly maxAmount: string;
  readonly maxItems: string;
}

export interface AutonomyGroupForm {
  readonly title: string;
  readonly rows: readonly AutonomyRowForm[];
}

export interface AutonomyForm {
  readonly groups: readonly AutonomyGroupForm[];
  readonly validityHours: string;
  readonly undoDays: string;
}

/** Tipos de dado e o que cada chave libera (spec 033, FR-018): criar, editar, categorizar, em lote. */
const GROUPS: readonly { title: string; rows: readonly { key: AutoActionKey; label: string }[] }[] = [
  {
    title: 'Lançamentos',
    rows: [
      { key: 'transaction.create', label: 'Lançar' },
      { key: 'transaction.update', label: 'Editar' },
      { key: 'transaction.categorize', label: 'Classificar (inclusive em lote)' },
    ],
  },
  { title: 'Ganhos', rows: [{ key: 'income.create', label: 'Registrar' }, { key: 'income.update', label: 'Editar' }] },
  { title: 'Gastos fixos', rows: [{ key: 'fixedExpense.create', label: 'Cadastrar' }, { key: 'fixedExpense.update', label: 'Editar' }] },
  { title: 'Categorias', rows: [{ key: 'category.create', label: 'Criar' }, { key: 'category.rename', label: 'Renomear' }] },
];

/** O que nunca e automatico, por mais que se libere (FR-020). */
export const ALWAYS_APPROVAL: readonly string[] = ['Excluir qualquer registro', 'Pagar fatura de cartão', 'Transferir entre contas'];

const reais = (cents: number): string => formatBrl(cents).replace('R$ ', '');

export function buildAutonomyForm(policy: AutonomyPolicy): AutonomyForm {
  return {
    groups: GROUPS.map((g) => ({
      title: g.title,
      rows: g.rows.map((r) => {
        const rule = policy.rules[r.key];
        return { key: r.key, label: r.label, enabled: rule.enabled, maxAmount: reais(rule.maxAmountCents), maxItems: String(rule.maxItems) };
      }),
    })),
    validityHours: String(policy.validityHours),
    undoDays: String(policy.undoDays),
  };
}

export function updateRow(form: AutonomyForm, key: AutoActionKey, patch: Partial<Omit<AutonomyRowForm, 'key' | 'label'>>): AutonomyForm {
  return { ...form, groups: form.groups.map((g) => ({ ...g, rows: g.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })) };
}

export type AutonomyPatch = {
  rules?: Record<string, { enabled?: boolean; maxAmountCents?: number; maxItems?: number }>;
  validityHours?: number;
  undoDays?: number;
};

export type AutonomyFormResult = { readonly ok: true; readonly patch: AutonomyPatch } | { readonly ok: false; readonly errors: readonly string[] };

const toInt = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number.parseInt(text.trim(), 10) : null);

/** Valida o formulario e devolve so o que mudou em relacao a politica salva (ou os erros em pt-BR). */
export function formToPatch(form: AutonomyForm, saved: AutonomyPolicy): AutonomyFormResult {
  const errors: string[] = [];
  const rules: NonNullable<AutonomyPatch['rules']> = {};
  for (const group of form.groups) {
    for (const row of group.rows) {
      const before = saved.rules[row.key];
      const change: { enabled?: boolean; maxAmountCents?: number; maxItems?: number } = {};
      if (row.enabled !== before.enabled) change.enabled = row.enabled;
      const cents = parseBrlToCents(row.maxAmount);
      const items = toInt(row.maxItems);
      if (row.enabled) {
        if (cents === null || cents <= 0) errors.push(`${group.title} › ${row.label}: valor máximo inválido`);
        if (items === null || items <= 0) errors.push(`${group.title} › ${row.label}: itens por vez deve ser maior que zero`);
      }
      if (cents !== null && cents > 0 && cents !== before.maxAmountCents) change.maxAmountCents = cents;
      if (items !== null && items > 0 && items !== before.maxItems) change.maxItems = items;
      if (Object.keys(change).length > 0) rules[row.key] = change;
    }
  }
  const validity = toInt(form.validityHours);
  const undo = toInt(form.undoDays);
  if (validity === null || validity < VALIDITY_HOURS_RANGE.min || validity > VALIDITY_HOURS_RANGE.max) errors.push(`Validade do plano: de ${VALIDITY_HOURS_RANGE.min} a ${VALIDITY_HOURS_RANGE.max} horas`);
  if (undo === null || undo < UNDO_DAYS_RANGE.min || undo > UNDO_DAYS_RANGE.max) errors.push(`Prazo para desfazer: de ${UNDO_DAYS_RANGE.min} a ${UNDO_DAYS_RANGE.max} dias`);
  if (errors.length > 0) return { ok: false, errors };
  const patch: AutonomyPatch = {};
  if (Object.keys(rules).length > 0) patch.rules = rules;
  if (validity !== null && validity !== saved.validityHours) patch.validityHours = validity;
  if (undo !== null && undo !== saved.undoDays) patch.undoDays = undo;
  return { ok: true, patch };
}

/** Texto da confirmacao ao LIGAR uma acao: mostra os limites e o prazo do desfazer (FR-018). */
export function confirmEnableText(row: AutonomyRowForm, undoDays: string): string {
  return `Permitir que o assistente faça isso sozinho (${row.label.toLowerCase()})? Ele poderá agir sem perguntar em itens de até R$ ${row.maxAmount}, até ${row.maxItems} por vez. Você poderá desfazer por ${undoDays} dias.`;
}

/** Chaves ligadas agora (para o resumo "Autonomia: 2 ações liberadas"). */
export function enabledCount(form: AutonomyForm): number {
  return form.groups.reduce((sum, g) => sum + g.rows.filter((r) => r.enabled).length, 0);
}
