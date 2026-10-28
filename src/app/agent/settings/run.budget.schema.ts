import { z } from 'zod';

/** Limites por pedido configuraveis: 1 a 100 passos, 5 s a 30 min, US$ 0,01 a US$ 20,00 e 1k a 500k tokens. */
export const runBudgetSchema = z.object({
  maxSteps: z.number().int().min(1).max(100),
  maxMs: z.number().int().min(5_000).max(1_800_000),
  maxCostMicroUsd: z.number().int().min(10_000).max(20_000_000),
  maxTokens: z.number().int().min(1_000).max(500_000).optional(),
});
