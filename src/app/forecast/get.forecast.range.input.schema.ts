import { z } from 'zod';

/**
 * Schema de "obter previsao de varios meses seguidos" (spec 002, design.md 6.4 - grafico
 * anual do Dashboard). Uma chamada carrega os repositorios uma vez e projeta `months` meses
 * a partir de `from`, em vez de o renderer chamar `forecast.get` 12 vezes.
 */
export const getForecastRangeInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  from: z.object({
    year: z.int().min(1970),
    month: z.int().min(1).max(12),
  }),
  /** Quantos meses projetar a partir de `from` (inclusive). */
  months: z.int().min(1).max(24),
  /** Janela de media movel/tendencia por categoria (RF-19). Default 3 meses se ausente. */
  windowMonths: z.int().min(1).max(24).optional(),
});

/** Entrada ja validada de `GetForecastRangeUseCase`. */
export type GetForecastRangeInput = z.infer<typeof getForecastRangeInputSchema>;
