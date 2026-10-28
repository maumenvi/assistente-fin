import { type ExtractedSheet } from '../../../../domain/agent/attachment/extracted.sheet.ts';
import { formatPtNumber } from './format.pt.number.ts';
import { sanitizeCell } from './sanitize.attachment.text.ts';

/** Cabecalho de uma aba para o modelo: nome, linhas, colunas e a soma das colunas numericas (calculada pelo app). */
export function sheetSummary(sheet: ExtractedSheet): string {
  const totals = Object.entries(sheet.numericTotals).map(([col, sum]) => `${sanitizeCell(sheet.header[Number(col)] ?? `coluna ${Number(col) + 1}`, 40)} = ${formatPtNumber(sum)}`);
  const rows = sheet.totalRows === sheet.rowCount ? `${sheet.totalRows} linhas` : `${sheet.rowCount} de ${sheet.totalRows} linhas lidas`;
  return `Aba "${sanitizeCell(sheet.name, 60)}": ${rows} · colunas: ${sheet.header.map((h) => sanitizeCell(h, 40)).join(' | ')}${totals.length === 0 ? '' : ` · totais (calculados pelo app): ${totals.join('; ')}`}`;
}

/** Uma linha da aba como texto compacto (`a | b | c`). */
export function rowLine(row: readonly string[]): string {
  return row.map((c) => sanitizeCell(c)).join(' | ');
}
