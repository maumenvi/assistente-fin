import { STRONG_EVIDENCE, SUPPRESSION_DAYS } from '../../../../domain/preference/lifecycle/constants.ts';
import { type CorrectionEvidence } from '../../../../domain/plan/rule/correction.evidence.ts';
import { RULE_MIN_EVIDENCE, RULE_WINDOW_DAYS } from '../../../../domain/plan/rule/rule.settings.ts';
import { type RuleSuggestion } from '../../../../domain/plan/rule/rule.suggestion.ts';
import { DAY_MS, ruleSuppressionKey, type RuleDeps } from './rule.deps.ts';

/**
 * Sugestao de regra (spec 033, FR-024): 2 aprovacoes do mesmo "comerciante -> categoria" em 90 dias,
 * sem regra ainda e sem recusa lembrada. Uma sugestao por par; so para o que acabou de ser registrado.
 */
export async function suggestRules(deps: RuleDeps, userId: string, recorded: readonly CorrectionEvidence[]): Promise<RuleSuggestion[]> {
  const now = deps.clock.now();
  const since = new Date(now.getTime() - RULE_WINDOW_DAYS * DAY_MS).toISOString();
  const seen = new Set<string>();
  const suggestions: RuleSuggestion[] = [];
  for (const { merchant, categoryId } of recorded) {
    const key = `${merchant}|${categoryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const history = await deps.db.plans.evidence.listByMerchant(userId, merchant, since);
    const count = history.filter((e) => e.categoryId === categoryId).length;
    if (count < RULE_MIN_EVIDENCE) continue;
    const existing = await deps.db.plans.rules.findByMerchant(userId, merchant);
    if (existing !== null) continue;
    if (await deps.db.preferences.suppressions.isSuppressed(userId, ruleSuppressionKey(merchant, categoryId), now.toISOString(), count)) continue;
    const category = await deps.db.categories.findById(userId, categoryId);
    if (category === null) continue;
    suggestions.push({ merchant, categoryId, categoryName: category.name.value, state: 'open' });
  }
  return suggestions;
}

/** Recusa lembrada por 90 dias (so evidencia forte volta a sugerir o mesmo par). */
export function suppressionFor(userId: string, merchant: string, categoryId: string, now: Date) {
  return { userId, key: ruleSuppressionKey(merchant, categoryId), until: new Date(now.getTime() + SUPPRESSION_DAYS * DAY_MS).toISOString(), strongEvidenceNeeded: STRONG_EVIDENCE };
}
