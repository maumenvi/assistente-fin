import { type Figure } from './figure.ts';

/** Texto que substitui uma figura nao confirmada. */
export const UNCONFIRMED_FIGURE_TEXT = '(valor não confirmado)';

/** Troca cada figura nao confirmada por "(valor não confirmado)", preservando o resto do texto. */
export function maskFigures(text: string, mismatches: readonly Figure[]): string {
  let out = text;
  for (const figure of [...mismatches].sort((a, b) => b.start - a.start)) {
    out = `${out.slice(0, figure.start)}${UNCONFIRMED_FIGURE_TEXT}${out.slice(figure.end)}`;
  }
  return out;
}
