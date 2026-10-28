import { z } from 'zod';

/** Argumento de mes das ferramentas: "AAAA-MM". */
export const monthArgSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use o formato AAAA-MM')
  .describe('Mes no formato AAAA-MM, ex.: 2026-09');

/** Mes ja separado em ano e mes. */
export interface MonthRef {
  readonly year: number;
  readonly month: number;
}

/** Converte "AAAA-MM" em ano/mes. */
export function parseMonthArg(text: string): MonthRef {
  return { year: Number(text.slice(0, 4)), month: Number(text.slice(5, 7)) };
}

/** Mes (UTC) da data de referencia, usado quando o modelo nao informa o mes. */
export function monthOf(date: Date): MonthRef {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "set/2026". */
export function monthLabel(ref: MonthRef): string {
  return `${MONTH_ABBR[ref.month - 1]}/${ref.year}`;
}

/** "2026-09". */
export function monthKey(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, '0')}`;
}
