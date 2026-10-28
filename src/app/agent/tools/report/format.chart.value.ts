import { formatBrl } from '../../verify/format.brl.ts';

const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Valor de um grafico como texto pt-BR: `BRL` vem em reais (convertido a centavos inteiros), `percent` ganha `%`. */
export function formatChartValue(value: number, unit: 'BRL' | 'percent' | 'count'): string {
  if (unit === 'BRL') return formatBrl(Math.round(value * 100));
  if (unit === 'percent') return `${NUMBER.format(value)}%`;
  return NUMBER.format(value);
}
