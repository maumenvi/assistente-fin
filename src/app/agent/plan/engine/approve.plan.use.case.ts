import { approvePlan as markApproved } from '../../../../domain/plan/lifecycle/approve.plan.ts';
import { expirePlan } from '../../../../domain/plan/lifecycle/expire.plan.ts';
import { markStale } from '../../../../domain/plan/lifecycle/mark.stale.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { recordApprovedCategorizations } from '../rules/record.correction.ts';
import { suggestRules } from '../rules/suggest.rules.ts';
import { applyPlan } from './apply.plan.ts';
import { findStaleItem, loadPlan, operationContext, partitionStaleItems, savePlan } from './engine.helpers.ts';
import { planLock } from './keyed.lock.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';
import { prepareEditedItem } from './prepare.edited.item.ts';

export interface ApprovePlanInput {
  readonly userId: string;
  readonly planId: string;
  /** Itens que ficam marcados; omitido = a selecao atual do plano. */
  readonly selectedItemIds?: readonly string[] | undefined;
  /** Edicoes por item (valor, data, categoria...); o item e reverificado. */
  readonly edits?: Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined;
}

/** Segue de `approved` para a revalidacao e a aplicacao (tambem usado na recuperacao). */
export async function runApproved(deps: PlanEngineDeps, plan: Plan): Promise<Plan> {
  const stale = await findStaleItem(plan, operationContext(deps, plan.userId));
  if (stale !== null) return savePlan(deps, markStale({ ...plan, status: 'pending' }, deps.clock.now()));
  return applyPlan(deps, plan, 'user');
}

/**
 * Aprovar (ordem do contrato): idempotencia, validade, selecao/edicoes, revalidacao, registro da
 * intencao (`approved`) e so entao a aplicacao atomica. Plano fora de `pending` volta como esta.
 */
export async function approvePlan(deps: PlanEngineDeps, input: ApprovePlanInput): Promise<Plan> {
  return planLock.run(input.planId, async () => {
    const plan = await loadPlan(deps, input.userId, input.planId);
    if (plan.status !== 'pending') return plan;
    const now = deps.clock.now();
    const expired = expirePlan(plan, now);
    if (expired.status === 'expired') return savePlan(deps, expired);

    let working = plan;
    if (input.edits !== undefined) {
      const items = [...working.items];
      for (const [itemId, edits] of Object.entries(input.edits)) {
        const index = items.findIndex((i) => i.id === itemId);
        const current = items[index];
        if (current !== undefined) items[index] = await prepareEditedItem(deps, input.userId, current, edits, working.userText);
      }
      working = { ...working, items };
    }
    const selected = input.selectedItemIds ?? working.items.filter((i) => i.selected).map((i) => i.id);
    let approved = markApproved(working, selected, now);
    const { freshIds, staleIds } = await partitionStaleItems(approved, operationContext(deps, input.userId));
    if (staleIds.length > 0 && freshIds.length === 0) return savePlan(deps, markStale(plan, now));
    if (staleIds.length > 0) {
      const staleSet = new Set(staleIds);
      approved = {
        ...approved,
        items: approved.items.map((item) =>
          staleSet.has(item.id)
            ? {
                ...item,
                selected: false,
                flags: [...item.flags, { flag: 'diverges', text: 'Item já alterado fora do plano; ignorado na aplicação.' }],
              }
            : item,
        ),
      };
    }
    await savePlan(deps, approved); // intencao registrada ANTES de aplicar; se falhar, nada foi aplicado
    return learnRules(deps, await applyPlan(deps, approved, 'user'));
  });
}

/** Depois de aprovado: guarda a evidencia e sugere regras (2 iguais em 90 dias). Nunca derruba a aprovacao. */
async function learnRules(deps: PlanEngineDeps, plan: Plan): Promise<Plan> {
  try {
    const recorded = await recordApprovedCategorizations(deps, plan);
    if (recorded.length === 0) return plan;
    const suggestions = await suggestRules(deps, plan.userId, recorded);
    return suggestions.length === 0 ? plan : await savePlan(deps, { ...plan, ruleSuggestions: [...(plan.ruleSuggestions ?? []), ...suggestions] });
  } catch {
    return plan;
  }
}
