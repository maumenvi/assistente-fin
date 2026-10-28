import { z } from 'zod';

/** Uso reportado no ultimo chunk. `cost` e do OpenRouter (em dolares). */
export const usageSchema = z.object({
  prompt_tokens: z.number().nullish(),
  completion_tokens: z.number().nullish(),
  prompt_tokens_details: z.object({ cached_tokens: z.number().nullish() }).nullish(),
  cost: z.number().nullish(),
});
