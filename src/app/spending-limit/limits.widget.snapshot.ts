import { z } from 'zod';
import { type LimitsWidgetData } from './limits.widget.data.ts';

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['spending-limit', 'credit-card']),
  usedPercent: z.int().min(0),
  status: z.enum(['normal', 'warning', 'over']),
});

/** Resumo do widget guardado no aparelho (spec 023, data-model "LimitsWidgetSnapshot"). */
export const limitsWidgetSnapshotSchema = z.object({
  version: z.literal(1),
  computedAt: z.iso.datetime({ offset: true }),
  data: z.object({
    month: z.object({ year: z.int(), month: z.int().min(1).max(12) }),
    spendingLimits: z.array(rowSchema),
    cards: z.array(rowSchema),
  }),
  lastAttemptFailedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type LimitsWidgetSnapshot = z.infer<typeof limitsWidgetSnapshotSchema>;

/** Resumo novo a partir de dados recem-calculados. */
export function freshSnapshot(data: LimitsWidgetData, now: Date): LimitsWidgetSnapshot {
  return {
    version: 1,
    computedAt: now.toISOString(),
    data: { month: data.month, spendingLimits: [...data.spendingLimits], cards: [...data.cards] },
    lastAttemptFailedAt: null,
  };
}

export function encodeLimitsWidgetSnapshot(snapshot: LimitsWidgetSnapshot): string {
  return JSON.stringify(snapshot);
}

/** Le o resumo; JSON invalido, forma errada ou versao desconhecida = sem resumo (`null`). */
export function decodeLimitsWidgetSnapshot(text: string | null): LimitsWidgetSnapshot | null {
  if (text === null || text.trim() === '') return null;
  try {
    const parsed = limitsWidgetSnapshotSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
