import { type MonthRef } from './month.arg.ts';

/** Primeiro e ultimo dia do mes em "AAAA-MM-DD" (calendario UTC). */
export function monthBounds(month: MonthRef): { readonly from: string; readonly to: string } {
  const mm = String(month.month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return { from: `${month.year}-${mm}-01`, to: `${month.year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}
