import { z } from 'zod';

/** Limite de ids de lotes lembrados como "ja importados ou dispensados" (spec 029, R9). */
export const MAX_REMEMBERED_BATCH_IDS = 200;

/** Quantas copias entregues ficam guardadas para o fallback do desatualizado (spec 029, R5). */
export const MAX_REMEMBERED_SNAPSHOTS = 20;

/** Orcamento padrao do texto copiado, em caracteres (spec 029, R6; a confirmar no aparelho). */
export const DEFAULT_CLIPBOARD_BUDGET = 400_000;

/**
 * Preferencias da troca com agentes de IA (spec 029, data-model.md §3): o que entra nas copias
 * (FR-012), o orcamento da area de transferencia (R6) e a memoria de lotes e copias. Do aparelho;
 * nao sincronizam.
 */
export const aiExchangePreferencesSchema = z.object({
  /** Janela das transacoes enviadas, em dias a partir de hoje; `null` = todo o historico. */
  periodDays: z.int().min(1).max(3650).nullable().default(null),
  excludedAccountIds: z.array(z.string().min(1)).default([]),
  excludedCategoryIds: z.array(z.string().min(1)).default([]),
  omitDescriptions: z.boolean().default(false),
  roundValues: z.boolean().default(false),
  clipboardBudget: z.int().min(20_000).max(900_000).default(DEFAULT_CLIPBOARD_BUDGET),
  lastRequestId: z.string().nullable().default(null),
  dismissedBatchIds: z.array(z.string().min(1)).max(MAX_REMEMBERED_BATCH_IDS).default([]),
  snapshots: z.array(z.object({ id: z.string().min(1), at: z.string().min(1) })).max(MAX_REMEMBERED_SNAPSHOTS).default([]),
  privacyNoticeSeen: z.boolean().default(false),
  lastShareAt: z.string().nullable().default(null),
});

export type AiExchangePreferences = z.infer<typeof aiExchangePreferencesSchema>;

/** Preferencias de um aparelho novo. */
export function defaultAiExchangePreferences(): AiExchangePreferences {
  return aiExchangePreferencesSchema.parse({});
}
