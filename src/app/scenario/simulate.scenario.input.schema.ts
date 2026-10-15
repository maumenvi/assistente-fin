import { z } from 'zod';
import { scenarioAdjustmentSchema } from './scenario.adjustment.schema.ts';

/** Schema da entrada de "simular cenario" (spec 002, RF-33). Nao persiste nada. */
export const simulateScenarioInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  adjustments: z.array(scenarioAdjustmentSchema).min(1, 'informe ao menos um ajuste'),
  /** Quantos meses projetar a partir do mes atual. Default 12. */
  horizonMonths: z.int().min(1).max(60).default(12),
});

/** Entrada ja validada de `SimulateScenarioUseCase`. */
export type SimulateScenarioInput = z.infer<typeof simulateScenarioInputSchema>;
