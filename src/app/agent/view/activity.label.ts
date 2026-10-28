import { NODE_LABELS } from '../graph/node.labels.ts';

/** O que o assistente esta fazendo, em linguagem de gente, para o indicador do chat. */
const ACTIVITY: Readonly<Record<string, string>> = Object.freeze({
  route: 'Entendendo o pedido…',
  answer: 'Respondendo…',
  react: 'Pensando…',
  tools: 'Consultando seus dados…',
  respond: 'Conferindo os valores…',
});

/** Texto do indicador para um no; no desconhecido usa o rotulo do diagrama ou o texto padrao. */
export function activityLabel(node: string | null): string {
  if (node === null) return 'Pensando…';
  return ACTIVITY[node] ?? NODE_LABELS[node] ?? 'Pensando…';
}
