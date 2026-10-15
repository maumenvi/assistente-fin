import { z } from 'zod';

/**
 * O que entra nos dados enviados ao agente (spec 029, FR-012): periodo, contas e categorias,
 * omitir descricoes e arredondar valores. Vem das preferencias do aparelho.
 */
export const agentExportOptionsSchema = z.object({
  periodDays: z.int().min(1).max(3650).nullable().default(null),
  excludedAccountIds: z.array(z.string().min(1)).default([]),
  excludedCategoryIds: z.array(z.string().min(1)).default([]),
  omitDescriptions: z.boolean().default(false),
  roundValues: z.boolean().default(false),
});

export type AgentExportOptions = z.infer<typeof agentExportOptionsSchema>;
