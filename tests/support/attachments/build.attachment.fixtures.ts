import { deflateSync } from 'node:zlib';
import { strToU8, zipSync } from 'fflate';

/** Linhas do extrato de exemplo: [data ISO, descricao, categoria, valor em centavos]. Determinístico. */
export const SAMPLE_ROWS: readonly (readonly [string, string, string, number])[] = Array.from({ length: 214 }, (_, i) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  const names = ['SUPERMERCADO ALVORADA', 'POSTO IPIRANGA', 'FARMÁCIA SÃO PAULO', 'RESTAURANTE AÇAÍ', 'PIX JOÃO'];
  const cats = ['Mercado', 'Transporte', 'Saúde', 'Restaurantes', ''];
  return [`2026-09-${day}`, names[i % 5] as string, cats[i % 5] as string, 1000 + ((i * 137) % 9000)] as const;
});

/** Totais esperados (em centavos e em número de linhas) dos arquivos de exemplo. */
export const EXPECTED_TOTALS = {
  rows: SAMPLE_ROWS.length,
  valueCents: SAMPLE_ROWS.reduce((sum, row) => sum + row[3], 0),
} as const;

const brl = (cents: number): string => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;

/** Codifica como Windows-1252/Latin-1 (caracteres acima de 255 viram `?`). */
export function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (ch) => (ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 63));
}

/** `extrato.csv`: separador `;`, virgula decimal, Latin-1, 214 linhas + cabecalho. */
export function sampleCsv(): Uint8Array {
  const lines = ['Data;Descrição;Categoria;Valor', ...SAMPLE_ROWS.map((r) => `${r[0].split('-').reverse().join('/')};${r[1]};${r[2]};${brl(r[3])}`)];
  return latin1(lines.join('\r\n'));
}

/** `notas.txt`: texto livre em UTF-8. */
export function sampleTxt(): Uint8Array {
  return strToU8('Compras da semana:\n- arroz 5kg R$ 32,90\n- feijão R$ 9,50\nTotal: R$ 42,40\n');
}

const xml = (body: string): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `extrato.xlsx` (ZIP de XML escrito na mão): abas "Extrato" (cabecalho, 214 linhas, data como serial) e "Resumo". */
export function sampleXlsx(): Uint8Array {
  const strings: string[] = [];
  const sst = (text: string): number => {
    const found = strings.indexOf(text);
    if (found >= 0) return found;
    strings.push(text);
    return strings.length - 1;
  };
  const excelSerial = (iso: string): number => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86_400_000);
  const col = (n: number): string => String.fromCharCode(65 + n);
  const cell = (c: number, r: number, v: number | string, style?: number): string =>
    typeof v === 'number' ? `<c r="${col(c)}${r}"${style === undefined ? '' : ` s="${style}"`}><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="s"><v>${sst(v)}</v></c>`;
  const header = ['Data', 'Descrição', 'Categoria', 'Valor'].map((h, c) => cell(c, 1, h)).join('');
  const rows = SAMPLE_ROWS.map((r, i) => `<row r="${i + 2}">${cell(0, i + 2, excelSerial(r[0]), 1)}${cell(1, i + 2, r[1])}${cell(2, i + 2, r[2] === '' ? 'Sem categoria' : r[2])}${cell(3, i + 2, r[3] / 100)}</row>`).join('');
  const sheet1 = xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${header}</row>${rows}</sheetData></worksheet>`);
  const sheet2 = xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cell(0, 1, 'Total')}${cell(1, 1, EXPECTED_TOTALS.valueCents / 100)}</row></sheetData></worksheet>`);
  const sharedStrings = xml(`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`);
  return zipSync({
    '[Content_Types].xml': strToU8(xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>')),
    '_rels/.rels': strToU8(xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')),
    'xl/workbook.xml': strToU8(xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Extrato" sheetId="1" r:id="rId1"/><sheet name="Resumo" sheetId="2" r:id="rId2"/></sheets></workbook>')),
    'xl/_rels/workbook.xml.rels': strToU8(xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')),
    'xl/styles.xml': strToU8(xml('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>')),
    'xl/sharedStrings.xml': strToU8(sharedStrings),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
  });
}

/** `corrompido.xlsx`: começa como ZIP mas nao e. */
export function corruptXlsx(): Uint8Array {
  return Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

/** Arquivo vazio. */
export function emptyFile(): Uint8Array {
  return new Uint8Array(0);
}

/** Monta um PDF com uma pagina: `lines` = linhas de celulas posicionadas por coluna (texto real). `lines: []` = pagina sem texto (escaneado). */
function buildPdf(lines: readonly (readonly string[])[]): Uint8Array {
  const xs = [40, 120, 330, 450];
  const content = lines.length === 0 ? '0.9 g 40 40 500 700 re f' : `BT /F1 11 Tf ${lines.map((cells, i) => cells.map((c, k) => `1 0 0 1 ${xs[k] ?? 40 + k * 100} ${780 - i * 16} Tm (${c.replace(/[()\\]/g, '')}) Tj`).join(' ')).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return strToU8(out);
}

/** `extrato.pdf`: texto real com cabecalho e 5 linhas em colunas. */
export function samplePdf(): Uint8Array {
  const rows = SAMPLE_ROWS.slice(0, 5).map((r) => [r[0].split('-').reverse().join('/'), r[1].replace(/[^\x20-\x7e]/g, ''), r[2].replace(/[^\x20-\x7e]/g, ''), brl(r[3])]);
  return buildPdf([['Data', 'Descricao', 'Categoria', 'Valor'], ...rows]);
}

/** `escaneado.pdf`: so uma imagem/forma, sem nenhum texto. */
export function scannedPdf(): Uint8Array {
  return buildPdf([]);
}

/** 1x1 PNG e JPEG (assinatura valida; o redutor de imagem e simulado nos testes). */
export function samplePng(): Uint8Array {
  return Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
}

export function sampleJpg(): Uint8Array {
  return Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'));
}

/** PNG sem compressao util (cinza): `width` x `height` de verdade, para testar a reducao de imagens grandes. */
export function bigPng(width: number, height: number): Uint8Array {
  const row = Buffer.alloc(1 + width * 3, 0x80);
  row[0] = 0;
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length);
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of buffer) c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Uint8Array.from(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** Largura e altura de um JPEG (marcador SOFn), ou `null` se nao achar. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1] as number;
    const length = ((bytes[i + 2] as number) << 8) | (bytes[i + 3] as number);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: ((bytes[i + 5] as number) << 8) | (bytes[i + 6] as number), width: ((bytes[i + 7] as number) << 8) | (bytes[i + 8] as number) };
    }
    i += 2 + length;
  }
  return null;
}
