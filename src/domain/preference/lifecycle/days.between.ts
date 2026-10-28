const DAY_MS = 86_400_000;

/** Dias (fracionarios, nunca negativos) entre duas datas ISO-8601. */
export function daysBetween(fromIso: string, to: Date): number {
  return Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / DAY_MS);
}
