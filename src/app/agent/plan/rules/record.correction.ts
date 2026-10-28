import { type Plan } from '../../../../domain/plan/plan.ts';
import { EVIDENCE_MAX, RULE_WINDOW_DAYS } from '../../../../domain/plan/rule/rule.settings.ts';
import { type CorrectionEvidence } from '../../../../domain/plan/rule/correction.evidence.ts';
import { normalizeMerchant } from '../../../../domain/plan/rule/normalize.merchant.ts';
import { DAY_MS, type RuleDeps } from './rule.deps.ts';

const KINDS = new Set(['transaction.categorize', 'transaction.update', 'transaction.create']);

/**
 * Guarda como evidencia cada categorizacao que o USUARIO aprovou (spec 033, FR-024): lancamento com
 * descricao e categoria de verdade (nao a padrao). Plano aplicado pela politica nao conta: ninguem
 * confirmou. Devolve o que foi registrado.
 */
export async function recordApprovedCategorizations(deps: RuleDeps, plan: Plan): Promise<CorrectionEvidence[]> {
  if (plan.origin !== 'user' || plan.status !== 'applied') return [];
  const now = deps.clock.now();
  const recorded: CorrectionEvidence[] = [];
  const kindOf = new Map(plan.items.map((i) => [i.id, i.kind]));
  for (const application of plan.applications) {
    if (!KINDS.has(kindOf.get(application.itemId) ?? '')) continue;
    for (const touched of application.touched) {
      if (touched.entity !== 'transaction' || touched.after === null) continue;
      const notes = typeof touched.after['notes'] === 'string' ? touched.after['notes'] : '';
      const categoryId = typeof touched.after['categoryId'] === 'string' ? touched.after['categoryId'] : '';
      const merchant = normalizeMerchant(notes);
      if (merchant === null || categoryId === '') continue;
      const category = await deps.db.categories.findById(plan.userId, categoryId);
      if (category === null || category.isDefault === true) continue;
      const evidence: CorrectionEvidence = { userId: plan.userId, merchant, categoryId, at: now.toISOString(), planId: plan.id };
      await deps.db.plans.evidence.append(evidence);
      recorded.push(evidence);
    }
  }
  if (recorded.length > 0) await deps.db.plans.evidence.prune(plan.userId, new Date(now.getTime() - RULE_WINDOW_DAYS * DAY_MS).toISOString(), EVIDENCE_MAX);
  return recorded;
}
