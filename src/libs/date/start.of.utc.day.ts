/** Meia-noite UTC do dia calendario de `date` - limite inferior de uma busca "mesmo dia". */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
