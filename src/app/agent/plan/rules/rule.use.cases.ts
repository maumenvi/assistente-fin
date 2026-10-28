import { z } from 'zod';
import { PlanInvalidOperationError } from '../../../../domain/plan/errors/plan.invalid.operation.error.ts';
import { PlanNotFoundError } from '../../../../domain/plan/errors/plan.not.found.error.ts';
import { type CategorizationRule } from '../../../../domain/plan/rule/categorization.rule.ts';
import { RULE_MIN_EVIDENCE } from '../../../../domain/plan/rule/rule.settings.ts';
import { type RuleSuggestion } from '../../../../domain/plan/rule/rule.suggestion.ts';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { suppressionFor } from './suggest.rules.ts';
import { type RuleDeps } from './rule.deps.ts';

const idSchema = z.string().trim().min(1).max(100);
const decideSchema = z.object({ userId: idSchema, planId: idSchema, merchant: z.string().trim().min(1).max(100) });
const updateSchema = z.object({ userId: idSchema, id: idSchema, categoryId: idSchema });
const refSchema = z.object({ userId: idSchema, id: idSchema });

function parse<T>(schema: z.ZodType<T>, raw: unknown, operation: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    throw new InvalidInputError(operation, flat.fieldErrors as Record<string, string[]>, flat.formErrors);
  }
  return parsed.data;
}

/** Regra com o nome da categoria, para a tela. */
export interface RuleView {
  readonly rule: CategorizationRule;
  readonly categoryName: string;
}

export async function listRules(deps: RuleDeps, userId: string): Promise<RuleView[]> {
  const rules = await deps.db.plans.rules.list(userId);
  const out: RuleView[] = [];
  for (const rule of rules) out.push({ rule, categoryName: (await deps.db.categories.findById(userId, rule.categoryId))?.name.value ?? '(categoria removida)' });
  return out;
}

async function setSuggestionState(deps: RuleDeps, userId: string, planId: string, merchant: string, state: RuleSuggestion['state']): Promise<RuleSuggestion> {
  const plan = await deps.db.plans.plans.get(userId, planId);
  if (plan === null) throw new PlanNotFoundError(planId);
  const suggestion = (plan.ruleSuggestions ?? []).find((s) => s.merchant === merchant);
  if (suggestion === undefined) throw new PlanInvalidOperationError(`sem sugestao de regra para "${merchant}"`);
  if (suggestion.state !== 'open') return suggestion;
  const next = { ...suggestion, state };
  await deps.db.plans.plans.save({ ...plan, ruleSuggestions: (plan.ruleSuggestions ?? []).map((s) => (s.merchant === merchant ? next : s)) });
  return next;
}

/** "Criar regra" na sugestao: grava a regra (vale na proxima proposta; sincroniza entre aparelhos). */
export async function confirmRuleSuggestion(deps: RuleDeps, rawInput: unknown): Promise<CategorizationRule> {
  const input = parse(decideSchema, rawInput, 'criar regra de categorizacao');
  const plan = await deps.db.plans.plans.get(input.userId, input.planId);
  if (plan === null) throw new PlanNotFoundError(input.planId);
  const suggestion = (plan.ruleSuggestions ?? []).find((s) => s.merchant === input.merchant);
  if (suggestion === undefined) throw new PlanInvalidOperationError(`sem sugestao de regra para "${input.merchant}"`);
  const now = deps.clock.now().toISOString();
  const existing = await deps.db.plans.rules.findByMerchant(input.userId, suggestion.merchant);
  const rule: CategorizationRule = existing
    ? { ...existing, categoryId: suggestion.categoryId, updatedAt: now }
    : { id: deps.ids.next(), userId: input.userId, merchant: suggestion.merchant, categoryId: suggestion.categoryId, origin: 'learned', confidence: 0.9, evidence: RULE_MIN_EVIDENCE, createdAt: now, updatedAt: now };
  await deps.db.plans.rules.save(rule);
  await setSuggestionState(deps, input.userId, input.planId, input.merchant, 'accepted');
  return rule;
}

/** "Agora nao": lembra a recusa por 90 dias (so evidencia forte volta a sugerir o par). */
export async function dismissRuleSuggestion(deps: RuleDeps, rawInput: unknown): Promise<void> {
  const input = parse(decideSchema, rawInput, 'recusar regra de categorizacao');
  const suggestion = await setSuggestionState(deps, input.userId, input.planId, input.merchant, 'dismissed');
  await deps.db.preferences.suppressions.put(suppressionFor(input.userId, suggestion.merchant, suggestion.categoryId, deps.clock.now()));
}

/** Troca a categoria de uma regra (vale na proxima proposta). */
export async function updateRule(deps: RuleDeps, rawInput: unknown): Promise<CategorizationRule> {
  const input = parse(updateSchema, rawInput, 'editar regra de categorizacao');
  const rule = await deps.db.plans.rules.get(input.userId, input.id);
  if (rule === null) throw new PlanNotFoundError(input.id);
  if ((await deps.db.categories.findById(input.userId, input.categoryId)) === null) throw new PlanInvalidOperationError(`categoria ${input.categoryId} nao encontrada`);
  const next = { ...rule, categoryId: input.categoryId, origin: 'said' as const, updatedAt: deps.clock.now().toISOString() };
  await deps.db.plans.rules.save(next);
  return next;
}

export async function deleteRule(deps: RuleDeps, rawInput: unknown): Promise<void> {
  const input = parse(refSchema, rawInput, 'apagar regra de categorizacao');
  await deps.db.plans.rules.delete(input.userId, input.id);
}
