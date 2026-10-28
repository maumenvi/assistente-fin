import { normalizeMerchant } from '../../../../domain/plan/rule/normalize.merchant.ts';
import { RECENT_CHECK, RULE_ITEM_CONFIDENCE, RULE_WINDOW_DAYS } from '../../../../domain/plan/rule/rule.settings.ts';
import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { DAY_MS, type RuleDeps } from './rule.deps.ts';

export interface RuleApplication {
  /** Argumentos da operacao com a categoria que a regra preencheu. */
  readonly raw: Readonly<Record<string, unknown>>;
  readonly confidence: number;
  readonly label: string;
  /** Alerta quando a regra contradiz as ultimas categorizacoes do comerciante. */
  readonly flag: PlanFlag | null;
}

/**
 * Aplica a regra a um lancamento NOVO sem categoria (spec 033, FR-025): descricao com comerciante
 * conhecido ganha a categoria da regra (`source: 'rule'`, confianca 0,95). Se as 3 ultimas
 * categorizacoes do comerciante contradizem a regra, o item sai com alerta `low_confidence`.
 */
export async function applyRule(deps: RuleDeps, userId: string, raw: Readonly<Record<string, unknown>>): Promise<RuleApplication | null> {
  if (raw['kind'] !== 'transaction.create') return null;
  if (typeof raw['categoryId'] === 'string' || typeof raw['categoryName'] === 'string') return null;
  const merchant = typeof raw['notes'] === 'string' ? normalizeMerchant(raw['notes']) : null;
  if (merchant === null) return null;
  const rule = await deps.db.plans.rules.findByMerchant(userId, merchant);
  if (rule === null) return null;
  const category = await deps.db.categories.findById(userId, rule.categoryId);
  if (category === null) return null;
  const since = new Date(deps.clock.now().getTime() - RULE_WINDOW_DAYS * DAY_MS).toISOString();
  const recent = (await deps.db.plans.evidence.listByMerchant(userId, merchant, since)).slice(0, RECENT_CHECK);
  const contradicting = recent.find((e) => e.categoryId !== rule.categoryId);
  let flag: PlanFlag | null = null;
  if (contradicting !== undefined) {
    const other = await deps.db.categories.findById(userId, contradicting.categoryId);
    flag = { flag: 'low_confidence', text: `a regra diz ${category.name.value}, mas nas últimas vezes foi ${other?.name.value ?? 'outra categoria'}` };
  }
  return { raw: { ...raw, categoryId: rule.categoryId }, confidence: RULE_ITEM_CONFIDENCE, label: `pela regra ${merchant} → ${category.name.value}`, flag };
}
