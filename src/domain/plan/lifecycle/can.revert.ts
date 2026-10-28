import { type Plan } from '../plan.ts';

/** Aplicado (ou parcial) e dentro da janela do desfazer. */
export function canRevert(plan: Plan, now: Date): boolean {
  if (plan.status !== 'applied' && plan.status !== 'partial') return false;
  return plan.revertUntil !== null && now.toISOString() <= plan.revertUntil;
}
