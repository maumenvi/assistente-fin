/** Estado de cor de um limite (spec 023, FR-002). */
export type UsageStatus = 'normal' | 'warning' | 'over';

/**
 * Regra unica de cor do "% usado" (Inicio e widget): a partir de 100% estourado, a partir de 80%
 * atencao, abaixo disso normal.
 */
export function usageStatus(percent: number): UsageStatus {
  if (percent >= 100) return 'over';
  if (percent >= 80) return 'warning';
  return 'normal';
}
