/** Ordem por unidades de codigo (igual em qualquer aparelho e idioma; `localeCompare` muda com a regiao e o motor JS). */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
