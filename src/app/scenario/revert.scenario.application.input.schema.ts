import { z } from 'zod';

/** Schema de "desfazer aplicacao removendo os lancamentos" (spec 002, RF-38). */
export const revertScenarioApplicationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  applicationId: z.string().trim().min(1, 'applicationId obrigatorio'),
});

/** Entrada ja validada de `RevertScenarioApplicationByRecordsUseCase`. */
export type RevertScenarioApplicationInput = z.infer<typeof revertScenarioApplicationInputSchema>;
