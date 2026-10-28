import { z } from 'zod';
import { DEFAULT_RUN_BUDGET, LEGACY_RUN_BUDGET } from '../../../domain/agent/default.run.budget.ts';
import { ROUTING_STRATEGIES } from '../../../domain/agent/routing/routing.strategy.ts';
import { modelProfileSchema } from './model.profile.schema.ts';
import { runBudgetSchema } from './run.budget.schema.ts';

/** Um perfil por papel (principal, rapido, alternativo). */
export function hasUniqueRoles(profiles: readonly { readonly role: string }[]): boolean {
  return new Set(profiles.map((p) => p.role)).size === profiles.length;
}

/** Configuracao do agente como guardada (nunca contem a chave de API). */
export const agentSettingsSchema = z.object({
  profiles: z.array(modelProfileSchema).max(3).refine(hasUniqueRoles, 'so um perfil por papel'),
  localOnly: z.boolean().default(false),
  // quem guardou o padrao antigo (nunca mexeu) passa a ter o novo padrao, bem maior
  limits: runBudgetSchema
    .default(() => ({ ...DEFAULT_RUN_BUDGET }))
    .transform((l) => (l.maxSteps === LEGACY_RUN_BUDGET.maxSteps && l.maxMs === LEGACY_RUN_BUDGET.maxMs && l.maxCostMicroUsd === LEGACY_RUN_BUDGET.maxCostMicroUsd && l.maxTokens === undefined ? { ...DEFAULT_RUN_BUDGET } : l)),
  routingStrategy: z.enum(ROUTING_STRATEGIES).optional(),
});
