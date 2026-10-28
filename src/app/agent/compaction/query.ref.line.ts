import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type QuerySummary } from '../../../domain/agent/query.summary.ts';

/**
 * Linha que substitui um resultado de consulta antigo no contexto (spec 032, FR-014): o que foi
 * consultado (rotulo), ferramenta, filtros e quantidade de itens, com o aviso de que os valores precisam ser consultados de novo. O
 * resultado completo nunca volta ao modelo; o `QuerySummary` guardado e o que sobrevive.
 */
export function queryRefLine(summary: QuerySummary): string {
  const filters = Object.entries(summary.filters)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  const items = summary.itemCount === 1 ? '1 item' : `${String(summary.itemCount)} itens`;
  return `[consulta: ${summary.label} (${summary.tool}{${filters}}) — ${items}; refaça a consulta para ver os valores]`;
}

/**
 * Ancora da ultima consulta da conversa (spec 037, US4, T038): preserva ferramenta e filtros
 * da consulta mais recente mesmo quando a mensagem original ja entrou na compactacao.
 */
export function lastQueryAnchorLine(messages: readonly AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg === undefined) continue;
    for (let j = msg.parts.length - 1; j >= 0; j -= 1) {
      const part = msg.parts[j];
      if (part?.type === 'query') {
        return `[Última consulta da conversa: ${queryRefLine(part.summary)}]`;
      }
    }
  }
  return '';
}
