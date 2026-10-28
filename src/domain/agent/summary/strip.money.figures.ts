const MONEY_PREFIX = /(-?)R\$\s?(-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|-?\d+(?:,\d{1,2})?)(?![\d])/g;
const MONEY_REAIS = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s+reais(?![\p{L}])/gu;

/** Troca todo valor monetario por `[valor]` (ultimo recurso antes de recusar o resumo). */
export function stripMoneyFigures(text: string): string {
  return text.replace(MONEY_PREFIX, '[valor]').replace(MONEY_REAIS, '[valor]');
}
