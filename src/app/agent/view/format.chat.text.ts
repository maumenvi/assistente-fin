import { type ChatTextBlock, type ChatTextRun } from './chat.text.block.ts';

/** `**negrito**`, `*italico*`/`_italico_`, `` `codigo` `` e `[texto](https://...)` em trechos; marcas sem par (e links que nao sao https) ficam como texto comum. */
function splitRuns(line: string): ChatTextRun[] {
  const runs: ChatTextRun[] = [];
  const pattern = /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(?<![*\w])\*([^*\s][^*]*)\*(?!\*)|(?<![\w])_([^_\s][^_]*)_(?!\w)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ text: line.slice(last, start), bold: false });
    if (match[1] !== undefined && match[2] !== undefined) runs.push({ text: match[1], bold: false, href: match[2] });
    else if (match[3] !== undefined) runs.push({ text: match[3], bold: true });
    else if (match[4] !== undefined) runs.push({ text: match[4], bold: false, code: true });
    else runs.push({ text: (match[5] ?? match[6]) as string, bold: false, italic: true });
    last = start + match[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last), bold: false });
  return runs.length === 0 ? [{ text: line, bold: false }] : runs;
}

const isTableLine = (line: string): boolean => line.startsWith('|') && line.indexOf('|', 1) > 0;
const isSeparator = (line: string): boolean => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line);

function cells(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/**
 * Texto da resposta -> blocos para a tela (spec 031, T086, ampliado): titulos (`#`), listas (`-`, `*`, `1.`), tabelas
 * (`| a | b |`), `**negrito**`, `*italico*`, `` `codigo` ``, links `[t](https://...)` e blocos ```` ``` ```` (viram `kind: 'code'`, copiaveis). Linhas em branco separam paragrafos. Nada de HTML: o texto nunca
 * e interpretado como marcacao (so vira texto no React). Tabela escrita colada numa linha so (`| a | b | |--|--| | 1 | 2 |`)
 * tambem e reconhecida.
 */
export function formatChatText(text: string): ChatTextBlock[] {
  const blocks: ChatTextBlock[] = [];
  let paragraph: string[] = [];
  let table: string[] = [];
  const flush = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', runs: splitRuns(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushTable = (): void => {
    if (table.length === 0) return;
    const sep = table.findIndex(isSeparator);
    const header = sep > 0 ? cells(table[0] as string) : null;
    const body = table.filter((_, i) => i !== sep && !(sep > 0 && i === 0));
    if (table.length >= 2 && header !== null) blocks.push({ kind: 'table', header: header.map(splitRuns), rows: body.map((l) => cells(l).map(splitRuns)) });
    else for (const l of table) paragraph.push(l);
    table = [];
    flush();
  };
  let fence: { lang: string; lines: string[] } | null = null;
  for (const raw of text.split('\n')) {
    const fenceMatch = /^\s*```\s*([\w+-]*)\s*$/.exec(raw);
    if (fence !== null) {
      if (fenceMatch !== null) {
        blocks.push({ kind: 'code', text: fence.lines.join('\n'), ...(fence.lang === '' ? {} : { lang: fence.lang }) });
        fence = null;
      } else fence.lines.push(raw.replace(/\s+$/, ''));
      continue;
    }
    if (fenceMatch !== null) {
      flushTable();
      flush();
      fence = { lang: fenceMatch[1] ?? '', lines: [] };
      continue;
    }
    let line = raw.trim();
    // tabela que o modelo escreveu numa linha so: "| a | b | |---|---| | 1 | 2 |"
    if (isTableLine(line) && /\|\s*\|[\s:-]*-{2,}/.test(line)) line = line.replace(/\|\s+\|/g, '|\n|');
    for (const part of line.split('\n')) {
      const l = part.trim();
      if (l === '') {
        flushTable();
        flush();
        continue;
      }
      if (isTableLine(l)) {
        flush();
        table.push(l);
        continue;
      }
      flushTable();
      const heading = /^(#{1,3})\s+(.*)$/.exec(l);
      const item = /^[-*•]\s+(.*)$/.exec(l);
      const numbered = /^(\d{1,2})[.)]\s+(.*)$/.exec(l);
      if (heading !== null) {
        flush();
        blocks.push({ kind: 'heading', level: (heading[1] as string).length as 1 | 2 | 3, runs: splitRuns(heading[2] as string) });
      } else if (item !== null) {
        flush();
        blocks.push({ kind: 'item', runs: splitRuns(item[1] as string) });
      } else if (numbered !== null) {
        flush();
        blocks.push({ kind: 'item', marker: `${numbered[1] as string}.`, runs: splitRuns(numbered[2] as string) });
      } else {
        paragraph.push(l);
      }
    }
  }
  flushTable();
  flush();
  if (fence !== null) blocks.push({ kind: 'code', text: fence.lines.join('\n'), ...(fence.lang === '' ? {} : { lang: fence.lang }) });
  return blocks;
}
