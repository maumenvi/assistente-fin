import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { type ContentWarning } from '../../../../domain/agent/attachment/content.warning.ts';
import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';
import { type PdfTextPort } from '../ports/pdf.text.port.ts';
import { columnTotals } from './column.totals.ts';
import { guessPdfTable, pdfPageLines } from './rebuild.pdf.table.ts';

/**
 * Extrai um PDF pela porta de texto (spec 036, R2): texto por pagina e, se houver linhas com o mesmo numero de colunas, a
 * tabela deduzida pela posicao (`tables_guessed`). Sem nenhum texto => `no_text` (provavelmente escaneado); senha/corrompido vem da porta.
 */
export async function extractPdf(bytes: Uint8Array, port: PdfTextPort): Promise<ExtractedContent> {
  const pages = await port.extract(bytes);
  const pageLines = pages.map(pdfPageLines);
  const allLines = pageLines.flat();
  if (allLines.length === 0) throw new AttachmentUnreadableError('no_text');
  let text = pageLines.map((lines) => lines.map((l) => l.cells.map((c) => c.text).join('  ')).join('\n')).join('\n\n');
  const warnings: ContentWarning[] = [];
  if (text.length > ATTACHMENT_LIMITS.maxTextChars) {
    text = text.slice(0, ATTACHMENT_LIMITS.maxTextChars);
    warnings.push({ code: 'truncated', detail: { chars: text.length } });
  }
  const table = guessPdfTable(allLines);
  const sheets: ExtractedContent['sheets'][number][] = [];
  if (table !== null) {
    const columns = Math.min(ATTACHMENT_LIMITS.maxColumns, table.header.length);
    const rows = table.rows.slice(0, ATTACHMENT_LIMITS.maxRowsPerSheet).map((r) => r.slice(0, columns).map((c) => c.trim()));
    sheets.push({ name: 'Tabela do PDF', header: table.header.slice(0, columns), rows, rowCount: rows.length, totalRows: table.rows.length, numericTotals: columnTotals(rows, columns) });
    warnings.push({ code: 'tables_guessed', detail: { rows: rows.length } });
  }
  return { kind: 'pdf', text, sheets, warnings, stats: { rows: allLines.length, chars: text.length, pages: pages.length } };
}
