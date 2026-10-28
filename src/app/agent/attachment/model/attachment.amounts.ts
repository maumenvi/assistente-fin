import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';
import { parseDecimal } from '../extract/parse.decimal.ts';

/** Numeros com cara de dinheiro dentro de um texto corrido (`1.234,56`, `R$ 87,50`). */
const MONEY_IN_TEXT = /-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2}\b/g;

/**
 * Valores (centavos, em modulo) que aparecem no conteudo extraido de um anexo: celulas numericas das tabelas e numeros com
 * duas casas no texto. Servem para o plano saber que o valor de um item VEIO do arquivo do usuario (nao e invencao do modelo).
 */
export function attachmentAmountsCents(content: ExtractedContent | null): Set<number> {
  const amounts = new Set<number>();
  if (content === null) return amounts;
  for (const sheet of content.sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        const value = parseDecimal(cell);
        if (value !== null) amounts.add(Math.round(Math.abs(value) * 100));
      }
    }
  }
  for (const match of content.text?.match(MONEY_IN_TEXT) ?? []) {
    const value = parseDecimal(match);
    if (value !== null) amounts.add(Math.round(Math.abs(value) * 100));
  }
  return amounts;
}
