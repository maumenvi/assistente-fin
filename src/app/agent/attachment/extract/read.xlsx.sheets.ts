import { unzipSync } from 'fflate';
import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { excelSerialToIso, isDateFormat } from './xlsx.date.ts';
import { decodeXmlText, xmlAttr, xmlTextOf } from './xlsx.xml.ts';

/** Uma aba lida do arquivo: nome e linhas de celulas ja como texto (colunas vazias = ''). */
export interface RawSheet {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
  readonly unreadableCells: number;
}

const utf8 = (bytes: Uint8Array | undefined): string => {
  if (bytes === undefined) return '';
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] as number;
    if (b < 0x80) out += String.fromCharCode(b);
    else {
      const len = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
      let code = len === 2 ? b & 0x1f : len === 3 ? b & 0x0f : b & 0x07;
      for (let k = 1; k < len; k += 1) code = (code << 6) | ((bytes[i + k] as number) & 0x3f);
      out += String.fromCodePoint(code);
      i += len - 1;
    }
  }
  return out;
};

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? 'A') n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readStyles(xml: string): { dateStyles: Set<number> } {
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\s([^>]*)\/?>/g)) {
    const id = xmlAttr(m[1] as string, 'numFmtId');
    const code = xmlAttr(m[1] as string, 'formatCode');
    if (id !== null && code !== null) custom.set(Number(id), code);
  }
  const dateStyles = new Set<number>();
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? '';
  let index = 0;
  for (const m of cellXfs.matchAll(/<xf\s([^>]*?)\/?>/g)) {
    const id = Number(xmlAttr(m[1] as string, 'numFmtId') ?? 0);
    if (isDateFormat(id, custom)) dateStyles.add(index);
    index += 1;
  }
  return { dateStyles };
}

/**
 * Le as abas de um .xlsx (ZIP de XML) so com `fflate` e regex: nomes das abas, strings compartilhadas, datas pelo estilo
 * numerico e valores (nao formulas). ZIP/XML invalido => `AttachmentUnreadableError('corrupt')`. Portavel (Hermes).
 */
export function readXlsxSheets(bytes: Uint8Array): RawSheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => /^(xl\/(workbook|styles|sharedStrings)\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/worksheets\/[^/]+\.xml)$/.test(f.name) });
  } catch {
    throw new AttachmentUnreadableError('corrupt');
  }
  const workbook = utf8(files['xl/workbook.xml']);
  if (workbook === '') throw new AttachmentUnreadableError('corrupt');
  const rels = new Map<string, string>();
  for (const m of utf8(files['xl/_rels/workbook.xml.rels']).matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = xmlAttr(m[1] as string, 'Id');
    const target = xmlAttr(m[1] as string, 'Target');
    if (id !== null && target !== null) rels.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  const shared: string[] = [];
  for (const m of utf8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(xmlTextOf(m[1] as string));
  const { dateStyles } = readStyles(utf8(files['xl/styles.xml']));

  const sheets: RawSheet[] = [];
  for (const m of workbook.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const attrs = m[1] as string;
    const name = xmlAttr(attrs, 'name') ?? `Aba ${sheets.length + 1}`;
    const rid = xmlAttr(attrs, 'r:id');
    const path = rid === null ? undefined : rels.get(rid);
    const xml = utf8(path === undefined ? undefined : files[path]);
    if (xml === '') continue;
    const rowsByIndex = new Map<number, string[]>();
    let unreadable = 0;
    for (const rowMatch of xml.matchAll(/<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rowNumber = Number(xmlAttr(rowMatch[1] as string, 'r') ?? rowsByIndex.size + 1);
      const cells: string[] = [];
      for (const cell of (rowMatch[2] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const cAttrs = cell[1] as string;
        const body = cell[2] ?? '';
        const col = columnIndex(xmlAttr(cAttrs, 'r') ?? 'A1');
        const type = xmlAttr(cAttrs, 't');
        const style = Number(xmlAttr(cAttrs, 's') ?? 0);
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = '';
        if (type === 'e') unreadable += 1;
        else if (type === 's') value = shared[Number(v ?? -1)] ?? '';
        else if (type === 'inlineStr') value = xmlTextOf(body);
        else if (type === 'b') value = v === '1' ? 'sim' : 'não';
        else if (type === 'str') value = decodeXmlText(v ?? '');
        else if (v !== undefined && v !== '') value = dateStyles.has(style) && Number.isFinite(Number(v)) ? excelSerialToIso(Number(v)) : String(Number(v));
        while (cells.length < col) cells.push('');
        cells[col] = value;
      }
      rowsByIndex.set(rowNumber, cells);
    }
    const ordered = [...rowsByIndex.keys()].sort((a, b) => a - b).map((k) => rowsByIndex.get(k) as string[]);
    sheets.push({ name, rows: ordered, unreadableCells: unreadable });
  }
  if (sheets.length === 0) throw new AttachmentUnreadableError('corrupt');
  return sheets;
}
