import { type Fact } from './fact.ts';

/** Um fato de dinheiro so e valido com `value` numerico inteiro (centavos). Outros tipos passam. */
export function isMoneyFactValid(fact: Fact): boolean {
  if (fact.kind !== 'money') return true;
  return typeof fact.value === 'number' && Number.isInteger(fact.value);
}
