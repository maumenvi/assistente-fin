import { type Fact } from '../../../../domain/agent/fact.ts';
import { formatBrl } from '../../verify/format.brl.ts';

/** Fato de dinheiro (centavos inteiros). O `sourceCallId` e carimbado pelo `RegistryToolPort`. */
export function moneyFact(id: string, label: string, cents: number): Fact {
  return { id, kind: 'money', value: cents, display: formatBrl(cents), label, sourceCallId: '' };
}
