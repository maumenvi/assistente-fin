import { z } from 'zod';

/**
 * Forma exata da linha JSON gravada em disco (spec 017, plano secao 2) - o que o Vector parseia.
 * Usado em teste para garantir que o formato nao diverge; nao roda a cada linha em producao.
 */
export const logEventOutputSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  source: z.enum(['mcp', 'ipc', 'sync', 'mobile']),
  operation: z.string(),
  userId: z.string().nullable(),
  // ausente nas linhas gravadas antes do complemento (spec 017)
  deviceId: z.string().nullable().optional(),
  correlationId: z.string(),
  durationMs: z.number().nonnegative(),
  outcome: z.enum(['success', 'error']),
  subjectIds: z.record(z.string(), z.string()),
  error: z
    .object({ name: z.string(), message: z.string(), stack: z.string().nullable() })
    .nullable(),
  input: z.unknown(),
});
