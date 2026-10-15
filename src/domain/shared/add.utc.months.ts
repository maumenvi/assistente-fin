/**
 * Soma `months` meses de calendario a `date` (pode ser negativo), em UTC, preservando o
 * dia e a hora do dia.
 *
 * Quando o dia nao existe no mes de destino (ex.: 31 de janeiro + 1 mes), ancora no ultimo
 * dia do mes de destino (28/29 de fevereiro) - clamp documentado da recorrencia mensal
 * (spec 003).
 */
export function addUtcMonths(date: Date, months: number): Date {
  const absoluteMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth - targetYear * 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(date.getUTCDate(), lastDayOfTargetMonth),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}
