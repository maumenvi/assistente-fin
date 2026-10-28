const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** O formato numerico (padrao ou personalizado) e de data/hora? */
export function isDateFormat(numFmtId: number, customFormats: ReadonlyMap<number, string>): boolean {
  if (BUILTIN_DATE_FORMATS.has(numFmtId)) return true;
  const code = customFormats.get(numFmtId);
  if (code === undefined) return false;
  return /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Numero serial do Excel -> `AAAA-MM-DD` (ou `AAAA-MM-DDTHH:MM` quando ha hora). */
export function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return Number.isInteger(serial) ? date : `${date}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
