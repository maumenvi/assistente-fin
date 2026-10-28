import { z } from 'zod';
import { ROUTING_STRATEGIES } from '../../../domain/agent/routing/routing.strategy.ts';
import { modelProfileSchema } from './model.profile.schema.ts';
import { modelCapabilitiesSchema } from './model.capabilities.schema.ts';
import { hasUniqueRoles } from './agent.settings.schema.ts';
import { runBudgetSchema } from './run.budget.schema.ts';

/** Perfil enviado pela tela: a chave so entra aqui (`apiKey`); sem ela, a chave ja guardada e mantida. */
export const modelProfileInputSchema = modelProfileSchema.omit({ keyRef: true, capabilities: true }).extend({
  apiKey: z.string().trim().min(1).max(500).optional(),
  clearKey: z.boolean().optional(),
  capabilities: modelCapabilitiesSchema.optional(),
});

/** Configuracao enviada pela tela ao salvar. */
export const agentSettingsInputSchema = z.object({
  profiles: z.array(modelProfileInputSchema).max(3).refine(hasUniqueRoles, 'so um perfil por papel'),
  localOnly: z.boolean(),
  limits: runBudgetSchema,
  routingStrategy: z.enum(ROUTING_STRATEGIES).optional(),
});
