/**
 * Frequencia de uma recorrencia de ganho, transacao manual ou simulacao (spec 003, RF-16).
 *
 * - `nao-repete`  evento unico, sem repeticao (ignora `everyN` e data final)
 * - `diaria`      repete a cada `everyN` dias
 * - `semanal`     repete a cada `everyN` semanas
 * - `mensal`      repete a cada `everyN` meses
 * - `trimestral`  repete a cada `everyN` trimestres (3 meses)
 * - `semestral`   repete a cada `everyN` semestres (6 meses)
 * - `anual`       repete a cada `everyN` anos
 *
 * O cadastro de novos lancamentos so usa `everyN: 1` (os presets acima); valores maiores
 * so aparecem em dados migrados (ex.: quinzenal = `semanal` a cada 2) - spec 003, RF-22.
 */
export const RECURRENCE_FREQUENCIES = [
  'nao-repete',
  'diaria',
  'semanal',
  'mensal',
  'trimestral',
  'semestral',
  'anual',
] as const;

/** Um dos valores de `RECURRENCE_FREQUENCIES`. */
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
