/**
 * Editar exige confirmacao com previa quando a pasta NAO esta sob git (spec 040, FR-012): com git a
 * pessoa ja desfaz pelo historico, entao grava direto.
 */
export function requiresEditConfirmation(insideGit: boolean): boolean {
  return !insideGit;
}
