import { type Fact } from '../../../../domain/agent/fact.ts';
import { type ToolResult } from '../../ports/tool/tool.result.ts';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function datesIn(value: unknown, into: Set<string>, depth = 0): void {
  if (depth > 3) return;
  if (typeof value === 'string' && ISO.test(value)) into.add(value);
  else if (Array.isArray(value)) value.forEach((v) => datesIn(v, into, depth + 1));
  else if (typeof value === 'object' && value !== null) Object.values(value).forEach((v) => datesIn(v, into, depth + 1));
}

/**
 * Fatos que decorrem da PROPRIA chamada (nao do conteudo dos dados): as datas pedidas (periodo consultado) e a quantidade de itens
 * achados. Sem eles, a resposta que diz "31 lancamentos de 01/01/2026 a 31/10/2026" era mascarada como "(valor nao confirmado)".
 */
export function callDerivedFacts(callId: string, args: unknown, result: ToolResult): Fact[] {
  if (!result.ok) return [];
  const facts: Fact[] = [];
  if (Number.isInteger(result.summary.itemCount) && result.summary.itemCount >= 0) {
    facts.push({ id: `${callId}:count`, kind: 'count', value: result.summary.itemCount, display: String(result.summary.itemCount), label: result.summary.label, sourceCallId: callId });
  }
  const dates = new Set<string>();
  datesIn(args, dates);
  for (const iso of dates) {
    const [y, m, d] = iso.split('-');
    facts.push({ id: `${callId}:date:${iso}`, kind: 'date', value: iso, display: `${d}/${m}/${y}`, label: 'periodo consultado', sourceCallId: callId });
  }
  return facts;
}
