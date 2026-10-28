import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { type ContentWarning } from '../../../../domain/agent/attachment/content.warning.ts';
import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';
import { type ExtractedSheet } from '../../../../domain/agent/attachment/extracted.sheet.ts';
import { columnTotals } from './column.totals.ts';
import { readXlsxSheets } from './read.xlsx.sheets.ts';

/**
 * Extrai um .xlsx (spec 036): todas as abas (ate 20), valores como texto (datas em ISO), ate 5 000 linhas e 50 colunas por aba.
 * O excedente vira aviso `truncated`; celula com erro vira vazia + `unreadable_cells`. A soma por coluna e calculada aqui.
 */
export function extractXlsx(bytes: Uint8Array): ExtractedContent {
  const raw = readXlsxSheets(bytes);
  const warnings: ContentWarning[] = [];
  if (raw.length > ATTACHMENT_LIMITS.maxSheets) warnings.push({ code: 'truncated', detail: { sheets: raw.length, kept: ATTACHMENT_LIMITS.maxSheets } });
  let unreadable = 0;
  let totalRows = 0;
  let chars = 0;
  const sheets: ExtractedSheet[] = [];
  for (const sheet of raw.slice(0, ATTACHMENT_LIMITS.maxSheets)) {
    unreadable += sheet.unreadableCells;
    const nonEmpty = sheet.rows.filter((r) => r.some((c) => c.trim() !== ''));
    if (nonEmpty.length === 0) continue;
    const columns = Math.min(ATTACHMENT_LIMITS.maxColumns, Math.max(...nonEmpty.map((r) => r.length)));
    const pad = (r: readonly string[]): string[] => Array.from({ length: columns }, (_, c) => (r[c] ?? '').trim());
    const header = pad(nonEmpty[0] as string[]);
    const body = nonEmpty.slice(1);
    const kept = body.slice(0, ATTACHMENT_LIMITS.maxRowsPerSheet).map(pad);
    if (body.length > kept.length) warnings.push({ code: 'truncated', detail: { sheet: sheet.name, rows: body.length, kept: kept.length } });
    totalRows += kept.length;
    chars += kept.reduce((sum, r) => sum + r.reduce((s, c) => s + c.length, 0), 0);
    sheets.push({ name: sheet.name, header, rows: kept, rowCount: kept.length, totalRows: body.length, numericTotals: columnTotals(kept, columns) });
  }
  if (sheets.length === 0) throw new AttachmentUnreadableError('empty');
  if (unreadable > 0) warnings.push({ code: 'unreadable_cells', detail: { cells: unreadable } });
  return { kind: 'xlsx', text: null, sheets, warnings, stats: { rows: totalRows, chars } };
}
