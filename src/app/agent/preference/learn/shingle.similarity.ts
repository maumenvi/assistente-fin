import { normalizeText } from '../../../../domain/preference/normalize.text.ts';

function shingles(text: string): Set<string> {
  const words = normalizeText(text).split(' ').filter((w) => w !== '');
  if (words.length < 2) return new Set(words);
  const out = new Set<string>();
  for (let i = 0; i < words.length - 1; i += 1) out.add(`${words[i]} ${words[i + 1]}`);
  return out;
}

/** Similaridade de Jaccard entre os pares de palavras consecutivas de dois textos (0 a 1). */
export function shingleSimilarity(a: string, b: string): number {
  const x = shingles(a);
  const y = shingles(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const s of x) if (y.has(s)) shared += 1;
  return shared / (x.size + y.size - shared);
}
