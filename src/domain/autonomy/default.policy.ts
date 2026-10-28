import { AUTO_ACTION_KEYS, type AutoActionKey } from '../plan/auto.action.key.ts';
import { DEFAULT_UNDO_DAYS, DEFAULT_VALIDITY_HOURS } from '../plan/plan.settings.ts';
import { type AutonomyPolicy } from './autonomy.policy.ts';
import { type AutonomyRule } from './autonomy.rule.ts';

/** Limites iniciais ao ligar uma acao: R$ 200,00 e 10 itens (clarificacao 2026-10-23). */
export const DEFAULT_MAX_AMOUNT_CENTS = 20_000;
export const DEFAULT_MAX_ITEMS = 10;

export function defaultRule(): AutonomyRule {
  return { enabled: false, maxAmountCents: DEFAULT_MAX_AMOUNT_CENTS, maxItems: DEFAULT_MAX_ITEMS };
}

/** Padrao: nada automatico (SC-005). */
export function defaultPolicy(userId: string, now: Date): AutonomyPolicy {
  const rules = Object.fromEntries(AUTO_ACTION_KEYS.map((k) => [k, defaultRule()])) as Record<AutoActionKey, AutonomyRule>;
  return { userId, rules, validityHours: DEFAULT_VALIDITY_HOURS, undoDays: DEFAULT_UNDO_DAYS, updatedAt: now.toISOString() };
}
