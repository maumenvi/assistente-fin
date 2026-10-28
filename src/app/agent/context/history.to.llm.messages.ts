import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { attachmentReference } from '../attachment/model/build.attachment.content.ts';
import { queryRefLine } from '../compaction/query.ref.line.ts';

function textOf(message: AgentMessage): string {
  const text = message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('');
  if (message.role === 'user') {
    const refs = message.parts.flatMap((p) => (p.type === 'attachment' ? [attachmentReference({ id: p.attachmentId, name: p.name, kind: p.kind, available: p.available })] : []));
    return refs.length === 0 ? text : [text, ...refs].join('\n');
  }
  const queries = message.parts.flatMap((p) => (p.type === 'query' ? [p.summary] : []));
  const plans = message.parts.flatMap((p) => (p.type === 'plan' ? [`[plano proposto: id ${p.planId}]`] : []));
  const requests = message.parts.flatMap((p) => (p.type === 'capability_request' ? [`[pedido de capacidade: id ${p.requestId}; aguarda a aprovacao do usuario]`] : []));
  const reports = message.parts.flatMap((p) => (p.type === 'report_saved' ? [`[relatorio ${p.format} salvo em ${p.path}]`] : []));
  if (queries.length === 0 && plans.length === 0 && requests.length === 0 && reports.length === 0) return text;
  return [text, ...queries.map(queryRefLine), ...plans, ...requests, ...reports].join('\n');
}

/**
 * Converte o historico salvo em mensagens para o modelo (spec 031, D12). Resultados completos de
 * ferramentas de turnos anteriores NAO voltam: no lugar vai uma linha com o resumo de cada
 * consulta, para o modelo saber o que ja foi consultado. Mensagens vazias, em streaming ou
 * interrompidas sem texto ficam de fora.
 */
export function historyToLlmMessages(history: readonly AgentMessage[]): LlmMessage[] {
  const out: LlmMessage[] = [];
  for (const message of history) {
    if (message.status === 'streaming') continue;
    const text = textOf(message).trim();
    if (text === '') continue;
    out.push(
      message.role === 'user'
        ? { role: 'user', content: [{ type: 'text', text }] }
        : { role: 'assistant', content: [{ type: 'text', text }] },
    );
  }
  return out;
}
