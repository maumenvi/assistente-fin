import { z } from 'zod';
import { type AutonomyPolicy } from '../../../../domain/autonomy/autonomy.policy.ts';
import { defaultRule } from '../../../../domain/autonomy/default.policy.ts';
import { validatePolicy } from '../../../../domain/autonomy/validate.policy.ts';
import { AUTO_ACTION_KEYS, type AutoActionKey } from '../../../../domain/plan/auto.action.key.ts';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { loadPolicy } from './engine.helpers.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

const ruleSchema = z.object({
  enabled: z.boolean().optional(),
  maxAmountCents: z.int().positive().optional(),
  maxItems: z.int().positive().optional(),
});

/** Entrada de `setAutonomy`: so o que veio muda. Ligar uma chave sem limites usa os padroes (R$ 200 / 10 itens). */
export const setAutonomyInputSchema = z.object({
  userId: z.string().trim().min(1),
  rules: z.partialRecord(z.enum(AUTO_ACTION_KEYS), ruleSchema).optional(),
  validityHours: z.int().optional(),
  undoDays: z.int().optional(),
});

/** Politica atual do usuario (o padrao, com tudo desligado, enquanto ele nunca a mudou). */
export function getAutonomy(deps: PlanEngineDeps, userId: string): Promise<AutonomyPolicy> {
  return loadPolicy(deps, userId);
}

/**
 * Muda a politica de autonomia (spec 033, FR-017/FR-021/FR-023). UNICO caminho de escrita: a tela de
 * configuracao. O agente nao tem ferramenta para isto e texto lido nunca chega aqui. Vale so para
 * planos NOVOS: um plano pendente ja criado nao muda de decisao.
 */
export async function setAutonomy(deps: PlanEngineDeps, raw: unknown): Promise<AutonomyPolicy> {
  const parsed = setAutonomyInputSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    throw new InvalidInputError('mudar autonomia', flat.fieldErrors, flat.formErrors);
  }
  const input = parsed.data;
  const current = await loadPolicy(deps, input.userId);
  const rules = { ...current.rules };
  for (const [key, patch] of Object.entries(input.rules ?? {})) {
    const k = key as AutoActionKey;
    const previous = current.rules[k] ?? defaultRule();
    rules[k] = {
      enabled: patch.enabled ?? previous.enabled,
      maxAmountCents: patch.maxAmountCents ?? previous.maxAmountCents,
      maxItems: patch.maxItems ?? previous.maxItems,
    };
  }
  const next = validatePolicy({
    userId: input.userId,
    rules,
    validityHours: input.validityHours ?? current.validityHours,
    undoDays: input.undoDays ?? current.undoDays,
    updatedAt: deps.clock.now().toISOString(),
  });
  await deps.db.plans.policies.save(next);
  return next;
}
