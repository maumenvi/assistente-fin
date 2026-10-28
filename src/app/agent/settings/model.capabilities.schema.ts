import { z } from 'zod';

/** Capacidades de um modelo, validadas na fronteira (configuracao salva ou vinda da tela). */
export const modelCapabilitiesSchema = z.object({
  tools: z.boolean(),
  parallelToolCalls: z.boolean(),
  vision: z.boolean(),
  structuredOutput: z.boolean(),
  contextWindow: z.number().int().min(1000).max(10_000_000),
  promptCache: z.enum(['none', 'implicit', 'explicit']),
  reasoning: z.boolean(),
  verifiedAt: z.string().nullable(),
});
