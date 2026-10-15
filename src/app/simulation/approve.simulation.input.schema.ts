import { z } from 'zod';

/** Schema da entrada externa de "aprovar simulacao" (spec 001, RF-11, RF-12). */
export const approveSimulationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  simulationId: z.string().trim().min(1, 'simulationId obrigatorio'),
  /** `'real'`: gera uma `Transaction` (valor cheio, na data da compra). `'planned'`: gera
   *  um `FixedExpense` - so permitido quando a simulacao e recorrente (plan.md, decisao 13). */
  as: z.enum(['real', 'planned']),
});

/** Entrada ja validada de `ApproveSimulationUseCase`. */
export type ApproveSimulationInput = z.infer<typeof approveSimulationInputSchema>;
