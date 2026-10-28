const YEARS_BACK = 5;
const YEARS_AHEAD = 1;

/** Motivo de invalidez quando a data cai fora de -5 anos .. +1 ano de hoje; `null` se esta ok ou ausente. */
export function checkDate(input: Readonly<Record<string, unknown>>, now: Date): string | null {
  const date = input['date'];
  if (typeof date !== 'string') return null;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return `data invalida: ${date}`;
  const min = new Date(now);
  min.setUTCFullYear(min.getUTCFullYear() - YEARS_BACK);
  const max = new Date(now);
  max.setUTCFullYear(max.getUTCFullYear() + YEARS_AHEAD);
  return parsed < min || parsed > max ? `data fora do intervalo aceito (-${YEARS_BACK} anos a +${YEARS_AHEAD} ano): ${date}` : null;
}
