import { z } from 'zod';
import { MODEL_ORIGINS } from '../../../domain/agent/model.origin.ts';
import { MODEL_ROLES } from '../../../domain/agent/model.role.ts';
import { baseUrlSchema } from './base.url.schema.ts';
import { modelCapabilitiesSchema } from './model.capabilities.schema.ts';
import { modelPricingSchema } from './model.pricing.schema.ts';
import { runBudgetSchema } from './run.budget.schema.ts';

/** Perfil de modelo como guardado: sem a chave, so a referencia `keyRef`. */
export const modelProfileSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(MODEL_ROLES),
  origin: z.enum(MODEL_ORIGINS),
  baseUrl: baseUrlSchema,
  model: z.string().trim().min(1).max(200),
  keyRef: z.string().min(1).max(200).nullable(),
  capabilities: modelCapabilitiesSchema,
  enabled: z.boolean(),
  limits: runBudgetSchema.optional(),
  pricing: modelPricingSchema.nullable().optional(),
});
