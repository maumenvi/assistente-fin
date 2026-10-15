/**
 * `true` quando `value` e `null`, `undefined` ou uma `Date` valida. Usado nas entidades pra
 * validar campos de data opcionais/anulaveis (ex.: `updatedAt`, `*VerifiedAt`, `approvedAt`)
 * por defesa em profundidade (CA-19, CA-20), sem repetir a mesma checagem em cada `build`.
 */
export function isValidOptionalDate(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (value instanceof Date && !Number.isNaN(value.getTime()))
  );
}
