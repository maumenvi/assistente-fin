import { z } from 'zod';

/** Schema das entradas que so identificam um cenario do usuario (get / delete / apply). */
export const scenarioIdInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  scenarioId: z.string().trim().min(1, 'scenarioId obrigatorio'),
});

/** Entrada ja validada de casos de uso que so precisam de `userId` + `scenarioId`. */
export type ScenarioIdInput = z.infer<typeof scenarioIdInputSchema>;
