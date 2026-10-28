import { parseDecimal } from './parse.decimal.ts';

/** Soma por coluna numerica (>= 80% das celulas nao vazias sao numeros), com duas casas. Calculado pelo app, nunca pelo modelo. */
export function columnTotals(rows: readonly (readonly string[])[], columns: number): Record<number, number> {
  const totals: Record<number, number> = {};
  for (let c = 0; c < columns; c += 1) {
    let filled = 0;
    let numeric = 0;
    let sum = 0;
    for (const row of rows) {
      const cell = (row[c] ?? '').trim();
      if (cell === '') continue;
      filled += 1;
      const n = parseDecimal(cell);
      if (n !== null) {
        numeric += 1;
        sum += n;
      }
    }
    if (filled > 0 && numeric / filled >= 0.8) totals[c] = Math.round(sum * 100) / 100;
  }
  return totals;
}
