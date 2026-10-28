import { type PdfPage } from '../ports/pdf.text.port.ts';

/** Uma celula de uma linha do PDF: o texto e onde ele comeca (X). */
export interface PdfCell {
  readonly text: string;
  readonly x: number;
}

/** Uma linha do PDF: as celulas (trechos separados por um vao horizontal grande) da esquerda para a direita. */
export interface PdfLine {
  readonly cells: readonly PdfCell[];
}

const Y_TOLERANCE = 3;
/** Vao horizontal (unidades do PDF) a partir do qual dois trechos viram celulas diferentes. */
const CELL_GAP = 9;
/** Distancia maxima (X) entre o inicio de uma celula e o de uma coluna do cabecalho para pertencer a ela. */
const COLUMN_TOLERANCE = 24;

/** Agrupa os itens de uma pagina em linhas (por Y, de cima para baixo) e as celulas de cada linha (por vao em X). */
export function pdfPageLines(page: PdfPage): PdfLine[] {
  const rows: { y: number; items: { text: string; x: number; width: number }[] }[] = [];
  for (const item of page.items) {
    if (item.text.trim() === '') continue;
    const entry = { text: item.text, x: item.x, width: item.width ?? item.text.length * 5.5 };
    const row = rows.find((r) => Math.abs(r.y - item.y) <= Y_TOLERANCE);
    if (row === undefined) rows.push({ y: item.y, items: [entry] });
    else row.items.push(entry);
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => {
      const items = r.items.sort((a, b) => a.x - b.x);
      const cells: { text: string; x: number }[] = [];
      let lastEnd = -Infinity;
      for (const it of items) {
        if (cells.length === 0 || it.x - lastEnd > CELL_GAP) cells.push({ text: it.text.trim(), x: it.x });
        else (cells[cells.length - 1] as { text: string }).text += ` ${it.text.trim()}`;
        lastEnd = it.x + it.width;
      }
      return { cells };
    });
}

/** Distribui as celulas de uma linha nas colunas do cabecalho pelo X; `null` se alguma celula nao cai em nenhuma coluna. */
function alignToColumns(line: PdfLine, columns: readonly number[]): string[] | null {
  const out = columns.map(() => '');
  for (const cell of line.cells) {
    let best = -1;
    let bestDistance = Infinity;
    columns.forEach((x, i) => {
      const d = Math.abs(cell.x - x);
      if (d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    });
    if (best < 0 || bestDistance > COLUMN_TOLERANCE) return null;
    out[best] = out[best] === '' ? cell.text : `${out[best]} ${cell.text}`;
  }
  return out;
}

/**
 * Tabela deduzida pela posicao: a partir de cada linha com >= 3 celulas (cabecalho), estende enquanto as linhas seguintes
 * (com >= 2 celulas) alinham com as colunas do cabecalho (celula vazia fica ''); fica a maior, com pelo menos 3 linhas
 * (cabecalho + 2). Devolve cabecalho e linhas, ou `null`.
 */
export function guessPdfTable(lines: readonly PdfLine[]): { header: string[]; rows: string[][] } | null {
  let best: { header: string[]; rows: string[][] } | null = null;
  for (let start = 0; start < lines.length; start += 1) {
    const head = lines[start] as PdfLine;
    if (head.cells.length < 3) continue;
    const columns = head.cells.map((c) => c.x);
    const rows: string[][] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i] as PdfLine;
      if (line.cells.length < 2) break;
      const aligned = alignToColumns(line, columns);
      if (aligned === null) break;
      rows.push(aligned);
    }
    if (rows.length >= 2 && (best === null || rows.length > best.rows.length)) best = { header: head.cells.map((c) => c.text), rows };
  }
  return best;
}
