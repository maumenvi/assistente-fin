const MONEY_PREFIX = /(-?)R\$\s?(-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|-?\d+(?:,\d{1,2})?)(?![\d])/;
const MONEY_REAIS = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s+reais(?![\p{L}])/u;

/**
 * O texto tem valor monetario ("R$ 12,50", "1.284,60 reais")? Mesma regra do verificador de
 * valores da spec 031 (copiada porque o dominio nao importa de `app/`; um teste de paridade
 * garante que as duas nao divergem). Usada para recusar valores no resumo (spec 032, FR-016).
 */
export function hasMoneyFigure(text: string): boolean {
  return MONEY_PREFIX.test(text) || MONEY_REAIS.test(text);
}
