import { z } from 'zod';

/** Entrada de retomada de uma execucao pausada por limite (spec 038, FR-009). */
export const continueRunInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  runId: z.string().trim().min(1, 'runId obrigatorio'),
  extraSteps: z.number().int().min(1).max(50).optional(),
  extraTokens: z.number().int().min(1_000).max(500_000).optional(),
});

export type ContinueRunInput = z.infer<typeof continueRunInputSchema>;

