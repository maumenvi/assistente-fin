/**
 * Percentual inteiro de `part` sobre `whole`; 0 quando `whole` e zero (spec 023). Unico calculo
 * de "% usado" do app: a tela Inicio e o widget mostram o mesmo numero (SC-005).
 */
export function usagePercent(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}
