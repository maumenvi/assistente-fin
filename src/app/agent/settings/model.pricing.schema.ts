import { z } from 'zod';

/** Preco customizado por 1M tokens em micro-dolares (spec 038, FR-003). */
export const modelPricingSchema = z.object({
  inputMicroUsdPer1M: z.number().int().min(0).max(500_000_000),
  outputMicroUsdPer1M: z.number().int().min(0).max(500_000_000),
});

