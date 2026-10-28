import { type PlanApplication } from '../plan.application.ts';
import { type Plan } from '../plan.ts';
import { movePlan } from './move.plan.ts';

/** Desfazer: `reverted` se todas as aplicacoes foram desfeitas, `partial` se algum item foi pulado. */
export function markReverted(plan: Plan, applications: readonly PlanApplication[], now: Date): Plan {
  const all = applications.every((a) => a.revertedAt !== null);
  // `partial` continua `partial` enquanto sobrar item sem desfazer (nao ha transicao partial -> partial)
  if (plan.status === 'partial' && !all) return { ...plan, applications };
  return movePlan(plan, all ? 'reverted' : 'partial', { applications, revertedAt: all ? now.toISOString() : plan.revertedAt });
}
