import { PlanNotFoundError } from '../../../../domain/plan/errors/plan.not.found.error.ts';
import { fingerprint } from '../../../../domain/plan/lifecycle/fingerprint.ts';
import { defaultPolicy } from '../../../../domain/autonomy/default.policy.ts';
import { type AutonomyPolicy } from '../../../../domain/autonomy/autonomy.policy.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanItem } from '../../../../domain/plan/plan.item.ts';
import { type OperationContext } from '../operations/operation.context.ts';
import { operationOf } from '../operations/operation.registry.ts';
import { readSnapshot } from '../operations/touch.snapshot.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

/** Politica salva do usuario, ou o padrao (tudo exige aprovacao). */
export async function loadPolicy(deps: PlanEngineDeps, userId: string): Promise<AutonomyPolicy> {
  return (await deps.db.plans.policies.get(userId)) ?? defaultPolicy(userId, deps.clock.now());
}

export async function loadPlan(deps: PlanEngineDeps, userId: string, planId: string): Promise<Plan> {
  const plan = await deps.db.plans.plans.get(userId, planId);
  if (plan === null) throw new PlanNotFoundError(planId);
  return plan;
}

/** Salva o plano e avisa quem escuta; falha do aviso nunca derruba a operacao. */
export async function savePlan(deps: PlanEngineDeps, plan: Plan): Promise<Plan> {
  await deps.db.plans.plans.save(plan);
  try {
    deps.notify?.(plan);
  } catch {
    // o aviso e so informativo
  }
  return plan;
}

export function operationContext(deps: PlanEngineDeps, userId: string): OperationContext {
  return { userId, now: deps.clock.now(), db: deps.db };
}

/** Impressao digital atual dos registros que o item observa (compara com `beforeFingerprint`). */
export async function currentFingerprint(item: PlanItem, ctx: OperationContext): Promise<string> {
  const adapter = operationOf(item.kind);
  const refs = adapter === undefined ? [] : await adapter.watch(item.input, ctx);
  return fingerprint(await Promise.all(refs.map((ref) => readSnapshot(ctx.db, ctx.userId, ref))));
}

/** Primeiro item selecionado cujos dados mudaram desde a proposta, ou `null` se tudo confere. */
export async function findStaleItem(plan: Plan, ctx: OperationContext): Promise<PlanItem | null> {
  for (const item of plan.items.filter((i) => i.selected)) {
    if ((await currentFingerprint(item, ctx)) !== item.beforeFingerprint) return item;
  }
  return null;
}

/** Separa os itens selecionados em intocados (`freshIds`) e ja alterados fora do plano (`staleIds`). */
export async function partitionStaleItems(
  plan: Plan,
  ctx: OperationContext,
): Promise<{ freshIds: string[]; staleIds: string[] }> {
  const freshIds: string[] = [];
  const staleIds: string[] = [];
  for (const item of plan.items.filter((i) => i.selected)) {
    if ((await currentFingerprint(item, ctx)) !== item.beforeFingerprint) {
      staleIds.push(item.id);
    } else {
      freshIds.push(item.id);
    }
  }
  return { freshIds, staleIds };
}
