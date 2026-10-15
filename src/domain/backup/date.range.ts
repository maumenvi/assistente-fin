/** Intervalo de datas inclusivo, "AAAA-MM-DD" (spec 022, FR-016). */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

/** A data (ISO completa ou so o dia) cai no intervalo? */
export function isInRange(date: unknown, range: DateRange): boolean {
  if (typeof date !== 'string' || date.length < 10) return false;
  const day = date.slice(0, 10);
  return day >= range.from && day <= range.to;
}

/** O mes `{year, month}` toca o intervalo? */
export function monthTouchesRange(period: unknown, range: DateRange): boolean {
  const p = period as { year?: unknown; month?: unknown } | null;
  if (typeof p?.year !== 'number' || typeof p.month !== 'number') return false;
  const first = `${String(p.year)}-${String(p.month).padStart(2, '0')}-01`;
  const last = `${String(p.year)}-${String(p.month).padStart(2, '0')}-31`;
  return first <= range.to && last >= range.from;
}
