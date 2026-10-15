import { z } from 'zod';
import { scenarioAdjustmentSchema } from './scenario.adjustment.schema.ts';

/**
 * Schema da entrada de "atualizar cenario" (spec 002, RF-36, RF-31). Campos de mudanca
 * opcionais; `expectedUpdatedAt` (opcional) e a versao lida - aplica a trava otimista.
 */
export const updateScenarioInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  scenarioId: z.string().trim().min(1, 'scenarioId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  name: z.string().trim().min(1).max(120, 'name muito longo').optional(),
  adjustments: z.array(scenarioAdjustmentSchema).min(1, 'informe ao menos um ajuste').optional(),
  horizonMonths: z.int().min(1).max(60).optional(),
});

/** Entrada ja validada de `UpdateScenarioUseCase`. */
export type UpdateScenarioInput = z.infer<typeof updateScenarioInputSchema>;
