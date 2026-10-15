import { z } from 'zod';
import {
  SCENARIO_ADJUSTMENT_MODES,
  SCENARIO_ADJUSTMENT_TARGETS,
} from '../../domain/scenario/scenario.adjustment.ts';

/** Mes de competencia `{ year, month }` na fronteira (mesma forma de `getMonthlyForecastInputSchema`). */
export const monthInputSchema = z.object({
  year: z.int().min(1970),
  month: z.int().min(1).max(12),
});

/**
 * Schema de um ajuste de cenario (spec 002, RF-32).
 *
 * `mode: 'add'` aceita valor negativo (reducao) mas nao `0`; `mode: 'replace'` exige `>= 0`.
 * A ordem `from <= to` e reforcada aqui e de novo na VO (defesa em profundidade).
 */
export const scenarioAdjustmentSchema = z
  .object({
    target: z.enum(SCENARIO_ADJUSTMENT_TARGETS),
    mode: z.enum(SCENARIO_ADJUSTMENT_MODES),
    label: z.string().trim().min(1, 'label obrigatorio').max(120, 'label muito longo'),
    amountCents: z.int('valor deve ser inteiro em centavos'),
    from: monthInputSchema,
    to: monthInputSchema,
  })
  .refine((value) => value.mode !== 'add' || value.amountCents !== 0, {
    error: 'ajuste "add" com valor 0 nao faz nada',
    path: ['amountCents'],
  })
  .refine((value) => value.mode !== 'replace' || value.amountCents >= 0, {
    error: 'ajuste "replace" nao aceita valor negativo',
    path: ['amountCents'],
  })
  .refine(
    (value) =>
      value.from.year < value.to.year ||
      (value.from.year === value.to.year && value.from.month <= value.to.month),
    { error: 'from deve ser <= to', path: ['to'] },
  );

/** Um ajuste ja validado na fronteira. */
export type ScenarioAdjustmentInput = z.infer<typeof scenarioAdjustmentSchema>;
