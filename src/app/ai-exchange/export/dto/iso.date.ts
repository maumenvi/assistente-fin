/** Data como `YYYY-MM-DD` (UTC), o formato de data do contrato com o agente. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Versao de uma entidade no contrato: `updatedAt` em ISO, ou `null` se nunca foi carimbada. */
export function toVersion(updatedAt: Date | null | undefined): string | null {
  return updatedAt === null || updatedAt === undefined ? null : updatedAt.toISOString();
}
