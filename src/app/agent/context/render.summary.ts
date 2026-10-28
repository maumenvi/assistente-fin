import { type ConversationSummary } from '../../../domain/agent/summary/conversation.summary.ts';
import { sanitizeText } from '../tools/shared/sanitize.text.ts';

function list(items: readonly string[]): string {
  return items.map((i) => sanitizeText(i, 160)).join('; ');
}

/**
 * Bloco do resumo da conversa (spec 032, FR-015; spec 037, T039): objetivo, decisoes, entidades por
 * identificador, pendencias, planos em aberto e combinados fixos do inicio reinjetados fora do resumo.
 * O cabecalho avisa que NAO ha valores ali - o agente consulta de novo. Vazio quando nao ha resumo nem combinados.
 */
export function renderSummary(
  summary: ConversationSummary | null,
  pinnedConstraints: readonly string[] = [],
): string {
  const blocks: string[] = [];
  if (pinnedConstraints.length > 0) {
    blocks.push(`[Combinados fixos da conversa: ${list(pinnedConstraints)}]`);
  }
  if (summary !== null) {
    const c = summary.content;
    const lines = [
      `[Resumo da conversa até a mensagem ${String(summary.coveredToSeq)} — NÃO use valores daqui; consulte as ferramentas quando precisar de números]`,
      `Objetivo: ${sanitizeText(c.goal, 200)}`,
    ];
    if (c.decisions.length > 0) lines.push(`Decisões: ${list(c.decisions)}`);
    if (c.entities.length > 0)
      lines.push(`Entidades: ${c.entities.map((e) => `${e.kind} ${sanitizeText(e.label, 60)} (id ${sanitizeText(e.id, 60)})`).join('; ')}`);
    if (c.pending.length > 0) lines.push(`Pendências: ${list(c.pending)}`);
    if (c.openPlans.length > 0) lines.push(`Planos em aberto: ${list(c.openPlans)}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}
