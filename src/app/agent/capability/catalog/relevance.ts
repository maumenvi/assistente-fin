function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'para', 'por', 'com', 'um', 'uma', 'o', 'a', 'os', 'as', 'que', 'e', 'no', 'na', 'hoje', 'quanto', 'qual', 'como', 'the', 'of', 'to', 'in', 'and']);

/** Palavras da busca que importam (sem acento, sem palavras de ligacao, ao menos 3 letras). */
export function queryWords(query: string): string[] {
  return normalize(query).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}

/**
 * Relevancia textual simples: quantas palavras da busca aparecem nos campos (por inicio de palavra, para
 * "converter"/"conversao" casarem). Zero = nao serve.
 */
export function relevance(query: string, fields: readonly string[]): number {
  const words = queryWords(query);
  if (words.length === 0) return 0;
  const haystack = normalize(fields.join(' ')).split(/[^a-z0-9]+/).filter((w) => w !== '');
  return words.filter((w) => haystack.some((h) => h.startsWith(w) || (w.length >= 5 && w.startsWith(h) && h.length >= 5) || (w.length >= 6 && h.length >= 6 && w.slice(0, 5) === h.slice(0, 5)))).length;
}
