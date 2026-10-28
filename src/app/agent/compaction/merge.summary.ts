import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type SummaryContent } from '../../../domain/agent/summary/summary.content.ts';
import { type NamedEntity } from '../../../domain/preference/select/select.context.ts';
import { historyToLlmMessages } from '../context/history.to.llm.messages.ts';

/** Maximo de caracteres de uma mensagem no texto enviado ao resumidor. */
const MESSAGE_CHARS = 600;

/** Ids de contas e categorias que o resumo pode citar: o catalogo do usuario e o que o resumo anterior ja citava. */
export function allowedEntityIds(accounts: readonly NamedEntity[], categories: readonly NamedEntity[], previous: SummaryContent | null): Set<string> {
  return new Set([...accounts.map((a) => a.id), ...categories.map((c) => c.id), ...(previous?.entities.map((e) => e.id) ?? [])]);
}

/**
 * Texto do bloco para o resumidor (spec 032, research P7): cada mensagem em uma linha ("Usuário:"/
 * "Assistente:"), com as referencias de consulta no lugar dos resultados; nada de valores guardados.
 */
export function renderBlock(messages: readonly AgentMessage[]): string {
  return historyToLlmMessages(messages)
    .map((m) => {
      const text = m.role === 'tool' ? '' : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('').replace(/\s+/g, ' ').trim();
      return `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${text.slice(0, MESSAGE_CHARS)}`;
    })
    .join('\n');
}

/** Mensagem de usuario do resumo incremental: catalogo de entidades, resumo anterior (se houver) e o bloco novo. */
export function buildSummaryRequestText(args: {
  readonly previous: SummaryContent | null;
  readonly accounts: readonly NamedEntity[];
  readonly categories: readonly NamedEntity[];
  readonly block: readonly AgentMessage[];
}): string {
  const catalog = [...args.accounts.map((a) => `conta ${a.name} → id ${a.id}`), ...args.categories.map((c) => `categoria ${c.name} → id ${c.id}`)].join('\n');
  return [
    `Contas e categorias do usuário (use estes ids em "entities"):\n${catalog === '' ? '(nenhuma)' : catalog}`,
    `Resumo anterior (JSON, ou "nenhum"):\n${args.previous === null ? 'nenhum' : JSON.stringify(args.previous)}`,
    `Mensagens novas para incorporar:\n${renderBlock(args.block)}`,
  ].join('\n\n');
}
