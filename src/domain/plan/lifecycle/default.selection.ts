import { MIN_SELECT_CONFIDENCE } from '../plan.settings.ts';
import { type PlanFlag } from '../plan.flag.ts';

/** Vem marcado so o item confiavel e sem alerta (FR-014). */
export function defaultSelected(confidence: number, flags: readonly PlanFlag[]): boolean {
  return confidence >= MIN_SELECT_CONFIDENCE && flags.length === 0;
}
