import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { type ContentWarning } from '../../../../domain/agent/attachment/content.warning.ts';
import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';
import { columnTotals } from './column.totals.ts';
import { decodeTextBytes } from './decode.text.bytes.ts';
import { detectCsvSeparator, parseCsvRows } from './parse.csv.rows.ts';

/**
 * Extrai um .csv (spec 036): separador `;`/`,`/tab detectado, aspas, virgula decimal, BOM e Latin-1. Uma aba com cabecalho e as
 * linhas (ate 5 000; o resto vira aviso `truncated`) e a soma por coluna numerica calculada aqui.
 */
export function extractCsv(bytes: Uint8Array): ExtractedContent {
  const text = decodeTextBytes(bytes);
  const all = parseCsvRows(text, detectCsvSeparator(text));
  if (all.length === 0) throw new AttachmentUnreadableError('empty');
  const columns = Math.min(ATTACHMENT_LIMITS.maxColumns, Math.max(...all.map((r) => r.length)));
  const header = (all[0] as string[]).slice(0, columns).map((h) => h.trim());
  const body = all.slice(1);
  const kept = body.slice(0, ATTACHMENT_LIMITS.maxRowsPerSheet).map((r) => Array.from({ length: columns }, (_, c) => (r[c] ?? '').trim()));
  const warnings: ContentWarning[] = [];
  if (body.length > kept.length) warnings.push({ code: 'truncated', detail: { rows: body.length, kept: kept.length } });
  const chars = kept.reduce((sum, r) => sum + r.reduce((s, c) => s + c.length, 0), 0);
  return {
    kind: 'csv',
    text: null,
    sheets: [{ name: 'CSV', header, rows: kept, rowCount: kept.length, totalRows: body.length, numericTotals: columnTotals(kept, columns) }],
    warnings,
    stats: { rows: kept.length, chars },
  };
}
