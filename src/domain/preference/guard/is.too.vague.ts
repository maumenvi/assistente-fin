import { normalizeText } from '../normalize.text.ts';

const GENERIC = /^((seja|ser|faca|fazer|responda|responder|ajude|ajudar|trabalhe|trabalhar)( \w+){0,2} (melhor|direito|certo|bem|bom|inteligente|esperto)|melhore|melhorar)$/;
const EMPTY_WORDS = new Set(['seja', 'faca', 'melhor', 'direito', 'certo', 'bem', 'bom', 'mais', 'um', 'uma', 'o', 'a', 'de', 'do', 'da', 'me', 'para', 'por', 'favor', 'sempre', 'prefiro', 'quero', 'inteligente', 'esperto', 'responda', 'ajude']);

/**
 * Preferencia vaga demais para gravar ("seja melhor", "faca direito"): sem nenhuma palavra
 * concreta. O agente pede uma frase mais especifica (spec 032, edge case).
 */
export function isTooVague(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized === '') return true;
  if (GENERIC.test(normalized)) return true;
  const concrete = normalized.split(' ').filter((w) => !EMPTY_WORDS.has(w));
  return concrete.length === 0;
}
