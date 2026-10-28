import { type Preference } from '../../../../domain/preference/preference.ts';
import { type PreferencesScreenData } from '../use-cases/preferences.screen.data.ts';
import { formatLastUsed } from './format.last.used.ts';
import { type PreferenceRowView } from './preference.row.view.ts';

/** Visao da tela de preferencias: abas, contagens e se esta vazia. */
export interface PreferenceListView {
  readonly active: readonly PreferenceRowView[];
  readonly tentative: readonly PreferenceRowView[];
  readonly candidates: readonly PreferenceRowView[];
  readonly isEmpty: boolean;
}

const TOPIC_LABEL: Readonly<Record<string, string>> = {
  response_length: 'tamanho da resposta',
  tone: 'tom',
  format: 'formato',
  show_account: 'exibir a conta',
  show_installment: 'exibir a parcela',
  number_style: 'estilo dos números',
  default_account: 'conta padrão',
  default_period: 'período padrão',
  auto_category: 'categoria automática',
};

function scopeLabel(p: Preference, data: PreferencesScreenData): string {
  if (p.scope.kind === 'global') return 'Global';
  const id = p.scope.id;
  const found = (p.scope.kind === 'account' ? data.accounts : data.categories).find((e) => e.id === id);
  const kind = p.scope.kind === 'account' ? 'Conta' : 'Categoria';
  return `${kind}: ${found?.name ?? 'removida'}`;
}

function originLabel(p: Preference): string {
  if (p.origin === 'said') return 'Dita por você';
  return p.status === 'active' ? 'Aprendida · confirmada' : 'Aprendida';
}

function toRow(p: Preference, data: PreferencesScreenData, now: Date): PreferenceRowView {
  return {
    id: p.id,
    text: p.text,
    status: p.status as PreferenceRowView['status'],
    scopeLabel: scopeLabel(p, data),
    originLabel: originLabel(p),
    lastUsedLabel: formatLastUsed(p.lastUsedAt, now),
    isPrivate: p.private,
    affectsData: p.effect === 'data',
    isNew: p.origin === 'learned' && p.status !== 'active',
    sourceRemoved: p.sourceMessageRemoved,
    topicLabel: p.topic.startsWith('other:') ? 'outro' : (TOPIC_LABEL[p.topic] ?? p.topic),
  };
}

/**
 * Visao da tela de preferencias (spec 032, FR-011/SC-008): ativas, tentativas e candidatas, cada uma
 * com texto, escopo, origem e ultimo uso. E o mesmo conteudo que `list_preferences` entrega ao agente.
 * Desativadas nao aparecem. Ordem: a mais recente primeiro dentro de cada aba.
 */
export function buildPreferenceListView(data: PreferencesScreenData, now: Date): PreferenceListView {
  const rows = (status: Preference['status']): PreferenceRowView[] =>
    data.preferences
      .filter((p) => p.status === status)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => toRow(p, data, now));
  const active = rows('active');
  const tentative = rows('tentative');
  const candidates = rows('candidate');
  return { active, tentative, candidates, isEmpty: active.length + tentative.length + candidates.length === 0 };
}
