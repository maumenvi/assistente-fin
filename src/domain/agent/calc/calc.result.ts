/**
 * Resultado exato de um calculo feito pelo app (spec 037, data-model.md).
 *
 * - `money`: `value` em centavos inteiros.
 * - `percent`: `value` em pontos-base inteiros (1% = 100 bp, ex.: 12,34% = 1234).
 * - `count`: `value` inteiro.
 */
export interface CalcResult {
  readonly kind: 'money' | 'percent' | 'count';
  /** Centavos (money), pontos-base (percent) ou unidades (count). */
  readonly value: number;
  /** Formula resumida que originou o resultado (ex.: `(set - ago) / ago`). */
  readonly formula: string;
  /** Identificadores dos fatos/consultas de origem, quando aplicavel. */
  readonly sources: readonly string[];
}

