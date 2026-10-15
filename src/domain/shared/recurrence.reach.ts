import { type RecurrenceFrequency } from './recurrence.frequency.ts';
import { addUtcDays } from './add.utc.days.ts';
import { addUtcMonths } from './add.utc.months.ts';

/**
 * Data final maxima que uma recorrencia dessa frequencia pode ter, contada a partir de
 * `anchor` (spec 003, RF-18). O editor sugere um valor <= este; a entidade recusa uma
 * `endDate` alem dele (RF-23).
 *
 * `nao-repete` nao tem alcance (a recorrencia nao tem data final) - chamar assim e erro de
 * programacao.
 */
export function maxEndDate(frequency: RecurrenceFrequency, anchor: Date): Date {
  switch (frequency) {
    case 'diaria':
      return addUtcDays(anchor, 30);
    case 'semanal':
      return addUtcDays(anchor, 280);
    case 'mensal':
    case 'trimestral':
      return addUtcMonths(anchor, 12);
    case 'semestral':
      return addUtcMonths(anchor, 24);
    case 'anual':
      return addUtcMonths(anchor, 144);
    case 'nao-repete':
      throw new Error('maxEndDate: "nao-repete" nao tem alcance');
  }
}

/**
 * Empurra `from` por exatamente um alcance maximo da frequencia (spec 003, RF-21 -
 * "prolongar"). Diferente de `maxEndDate`, que ancora na data inicial: aqui a base e a data
 * final atual da serie, entao "prolongar" avanca em passos do tamanho do alcance (CA-25b).
 *
 * `nao-repete` nao tem alcance - chamar assim e erro de programacao.
 */
export function extendByOneReach(frequency: RecurrenceFrequency, from: Date): Date {
  return maxEndDate(frequency, from);
}

/**
 * `true` quando `endDate` cabe na janela permitida da recorrencia: estritamente depois de
 * `anchor` e ate `maxEndDate(frequency, anchor)`, inclusive (spec 003, RF-18, RF-23).
 *
 * `nao-repete` nunca "cabe" - essa frequencia nao tem data final.
 */
export function isWithinMaxReach(
  frequency: RecurrenceFrequency,
  anchor: Date,
  endDate: Date,
): boolean {
  if (frequency === 'nao-repete') {
    return false;
  }
  const end = endDate.getTime();
  return end > anchor.getTime() && end <= maxEndDate(frequency, anchor).getTime();
}
