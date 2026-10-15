/**
 * Soma `days` dias a `date` (pode ser negativo), preservando a hora do dia.
 *
 * Opera sobre o timestamp: em UTC nao ha horario de verao, entao "dia" = 86.400.000 ms
 * exatos. Usado pela recorrencia (spec 003) para calcular alcance e ocorrencias de
 * frequencias `diaria`/`semanal`.
 */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
