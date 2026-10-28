import { type ConversationSummary } from '../../../domain/agent/summary/conversation.summary.ts';
import { formatLastUsed } from '../preference/view/format.last.used.ts';

/** O item "Contexto resumido" expandido (spec 032, FR-019a): somente leitura. */
export interface SummaryView {
  readonly title: string;
  /** "gerado hoje", "gerado ha 3 dias"... */
  readonly generatedLabel: string;
  readonly sections: readonly { readonly label: string; readonly items: readonly string[] }[];
  /** Lembrete fixo: valores nao ficam no resumo. */
  readonly note: string;
}

/** Titulo do separador na conversa: "Contexto resumido · mensagens 1 a 120". */
export function summaryMarkerTitle(coveredFromSeq: number, coveredToSeq: number): string {
  return `Contexto resumido · mensagens ${String(coveredFromSeq)} a ${String(coveredToSeq)}`;
}

/** Monta a visao do resumo; secoes vazias nao aparecem. */
export function buildSummaryView(summary: ConversationSummary, now: Date): SummaryView {
  const c = summary.content;
  const sections = [
    { label: 'Objetivo', items: [c.goal] },
    { label: 'Decisões', items: c.decisions },
    { label: 'Entidades', items: c.entities.map((e) => `${e.label} (${{ account: 'conta', card: 'cartão', category: 'categoria', period: 'período' }[e.kind]})`) },
    { label: 'Pendências', items: c.pending },
    { label: 'Planos em aberto', items: c.openPlans },
  ].filter((s) => s.items.length > 0);
  return {
    title: summaryMarkerTitle(summary.coveredFromSeq, summary.coveredToSeq),
    generatedLabel: `gerado ${formatLastUsed(summary.createdAt, now)}`,
    sections,
    note: 'Valores não ficam no resumo: o assistente consulta de novo quando precisa.',
  };
}
