import { type PlanApplication } from '../plan.application.ts';
import { type Plan } from '../plan.ts';
import { movePlan } from './move.plan.ts';

const DAY_MS = 86_400_000;

/** Fim da aplicacao: define `appliedAt` e a janela do desfazer (`revertUntil`). */
export function markApplied(plan: Plan, applications: readonly PlanApplication[], undoDays: number, now: Date): Plan {
  return movePlan(plan, 'applied', {
    applications,
    appliedAt: now.toISOString(),
    revertUntil: new Date(now.getTime() + undoDays * DAY_MS).toISOString(),
    lastError: null,
  });
}
