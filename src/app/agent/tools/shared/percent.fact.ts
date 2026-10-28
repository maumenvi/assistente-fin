import { type Fact } from '../../../../domain/agent/fact.ts';

/** Fato de percentual inteiro (ex.: 28 -> "28%"). */
export function percentFact(id: string, label: string, percent: number): Fact {
  return { id, kind: 'percent', value: percent, display: `${percent}%`, label, sourceCallId: '' };
}
