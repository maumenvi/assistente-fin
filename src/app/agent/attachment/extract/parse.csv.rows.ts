/** Separador de CSV mais provavel (`;`, `,` ou tab) pela amostra das primeiras linhas, fora de aspas. */
export function detectCsvSeparator(text: string): ';' | ',' | '\t' {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let quoted = false;
  let lines = 0;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === '\n') {
      lines += 1;
      if (lines >= 5) break;
    } else if (!quoted && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const best = (['\t', ';', ','] as const).reduce((a, b) => ((counts[b] ?? 0) > (counts[a] ?? 0) ? b : a));
  return best;
}

/** Linhas de um CSV (RFC 4180: aspas, aspas duplas escapadas, quebras de linha dentro de aspas). */
export function parseCsvRows(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
