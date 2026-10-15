/** `true` se a data ISO cai no mes (UTC) informado. */
export function isInMonth(isoDate: string, month: { readonly year: number; readonly month: number }): boolean {
  const date = new Date(isoDate);
  return date.getUTCFullYear() === month.year && date.getUTCMonth() + 1 === month.month;
}
