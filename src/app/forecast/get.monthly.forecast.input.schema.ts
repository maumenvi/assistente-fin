import { z } from 'zod';

/** Schema da entrada externa de "obter previsao do mes" (spec 001, RF-7, RF-12). */
export const getMonthlyForecastInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  month: z.object({
    year: z.int().min(1970),
    month: z.int().min(1).max(12),
  }),
  /** Janela de media movel/tendencia por categoria (RF-19). Default 3 meses se ausente. */
  windowMonths: z.int().min(1).max(24).optional(),
});

/** Entrada ja validada de `GetMonthlyForecastUseCase`. */
export type GetMonthlyForecastInput = z.infer<typeof getMonthlyForecastInputSchema>;
