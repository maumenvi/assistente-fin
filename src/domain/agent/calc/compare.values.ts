import { CalcDivisionByZeroError } from '../errors/calc.division.by.zero.error.ts';
import { CalcInvalidExpressionError } from '../errors/calc.invalid.expression.error.ts';
import { CalcNoDataError } from '../errors/calc.no.data.error.ts';
import { type CalcResult } from './calc.result.ts';
import { roundHalfEven } from './round.half.even.ts';

export type NamedCalcOp = 'sum' | 'avg' | 'diff' | 'pct_of' | 'pct_change' | 'project';

export interface CompareValuesInput {
  readonly op: NamedCalcOp;
  /** Valores em centavos inteiros. */
  readonly valuesCents: readonly number[];
  /** Quantidade de meses para `project` (padrao 1). */
  readonly months?: number;
  readonly sources?: readonly string[];
}

/**
 * Variacao percentual de `baseCents` (periodo A) para `targetCents` (periodo B) em pontos-base
 * (`1% = 100 bp`). Devolve `null` quando `baseCents === 0` (nunca infinito — spec 037, data-model.md).
 */
export function pctChangeBp(baseCents: number, targetCents: number): number | null {
  if (baseCents === 0) return null;
  const diff = BigInt(Math.trunc(targetCents) - Math.trunc(baseCents));
  const base = BigInt(Math.abs(Math.trunc(baseCents)));
  return Number(roundHalfEven(diff * 10_000n, base));
}

/**
 * Executa uma operacao nomeada (`sum`, `avg`, `diff`, `pct_of`, `pct_change`, `project`) sobre
 * valores em centavos inteiros com arredondamento half-even (spec 037, R4, T019).
 */
export function compareValues(input: CompareValuesInput): CalcResult {
  const { op, valuesCents, sources = [] } = input;
  if (valuesCents.length === 0) throw new CalcNoDataError('nenhum valor informado para o calculo');
  const ints = valuesCents.map((v) => BigInt(Math.trunc(v)));

  switch (op) {
    case 'sum': {
      const total = ints.reduce((acc, v) => acc + v, 0n);
      return { kind: 'money', value: Number(total), formula: `soma(${valuesCents.length} itens)`, sources };
    }
    case 'avg': {
      const total = ints.reduce((acc, v) => acc + v, 0n);
      const avg = roundHalfEven(total, BigInt(ints.length));
      return { kind: 'money', value: Number(avg), formula: `media(${valuesCents.length} itens)`, sources };
    }
    case 'diff': {
      if (ints.length !== 2) throw new CalcInvalidExpressionError('diff exige exatamente 2 valores');
      const diff = (ints[0] as bigint) - (ints[1] as bigint);
      return { kind: 'money', value: Number(diff), formula: 'valor1 - valor2', sources };
    }
    case 'pct_of': {
      if (ints.length !== 2) throw new CalcInvalidExpressionError('pct_of exige exatamente 2 valores (parte, total)');
      const [part, whole] = ints as [bigint, bigint];
      if (whole === 0n) throw new CalcDivisionByZeroError('total igual a zero em pct_of');
      const bp = roundHalfEven(part * 10_000n, whole);
      return { kind: 'percent', value: Number(bp), formula: 'parte / total', sources };
    }
    case 'pct_change': {
      if (ints.length !== 2) throw new CalcInvalidExpressionError('pct_change exige exatamente 2 valores (base, atual)');
      const bp = pctChangeBp(valuesCents[0] as number, valuesCents[1] as number);
      if (bp === null) throw new CalcDivisionByZeroError('base igual a zero em pct_change');
      return { kind: 'percent', value: bp, formula: '(atual - base) / base', sources };
    }
    case 'project': {
      const months = input.months ?? 1;
      if (!Number.isInteger(months) || months < 1) throw new CalcInvalidExpressionError('months deve ser inteiro >= 1');
      const total = ints.reduce((acc, v) => acc + v, 0n);
      const projected = roundHalfEven(total * BigInt(months), BigInt(ints.length));
      return { kind: 'money', value: Number(projected), formula: `media(${valuesCents.length}) * ${months}m`, sources };
    }
  }
}

