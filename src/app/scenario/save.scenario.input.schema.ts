import { z } from 'zod';
import { scenarioAdjustmentSchema } from './scenario.adjustment.schema.ts';

/** Schema da entrada de "salvar cenario" (spec 002, RF-34). */
export const saveScenarioInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  name: z.string().trim().min(1, 'name obrigatorio').max(120, 'name muito longo'),
  adjustments: z.array(scenarioAdjustmentSchema).min(1, 'informe ao menos um ajuste'),
  horizonMonths: z.int().min(1).max(60).default(12),
});

/** Entrada ja validada de `SaveScenarioUseCase`. */
export type SaveScenarioInput = z.infer<typeof saveScenarioInputSchema>;
