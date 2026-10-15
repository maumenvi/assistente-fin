import { movingAverage } from './moving.average.ts';

/**
 * Tendencia de uma serie de valores (spec 001, RF-19, CA-18): media das variacoes
 * mes-a-mes, em ordem cronologica (`values[0]` e o mes mais antigo).
 *
 * Opera sobre `number[]` (centavos), mesma razao de `moving.average.ts` (que reusa aqui pra
 * tirar a media dos deltas). Com menos de 2 pontos nao da pra medir variacao - devolve 0
 * (CA-18: sem dado historico suficiente, sem tendencia, so a media move o numero).
 */
export function categoryTrend(values: readonly number[]): number {
  if (values.length < 2) return 0;

  const deltas: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1] ?? 0;
    const current = values[index] ?? 0;
    deltas.push(current - previous);
  }
  return movingAverage(deltas);
}
