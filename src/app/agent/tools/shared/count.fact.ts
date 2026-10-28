import { type Fact } from '../../../../domain/agent/fact.ts';

/** Fato de quantidade (inteiro). */
export function countFact(id: string, label: string, count: number): Fact {
  return { id, kind: 'count', value: count, display: String(count), label, sourceCallId: '' };
}
