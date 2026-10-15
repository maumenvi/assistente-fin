import { z } from 'zod';

/**
 * Preferencias do widget de limites (spec 023, data-model): cartoes a mostrar (padrao nenhum) e
 * categorias cujos limites ficam escondidos (padrao nenhuma). Do aparelho; nao sincronizam.
 */
export const limitsWidgetPreferencesSchema = z.object({
  visibleCardIds: z.array(z.string().min(1)).default([]),
  hiddenCategoryIds: z.array(z.string().min(1)).default([]),
});

export type LimitsWidgetPreferences = z.infer<typeof limitsWidgetPreferencesSchema>;

/** Preferencias de um aparelho novo. */
export const DEFAULT_LIMITS_WIDGET_PREFERENCES: LimitsWidgetPreferences = { visibleCardIds: [], hiddenCategoryIds: [] };
