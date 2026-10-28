import { normalizeText } from '../../../domain/preference/normalize.text.ts';
import { type PreferenceTopic } from '../../../domain/preference/preference.topic.ts';

const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'ao', 'aos', 'para', 'por', 'com', 'que', 'sempre', 'nunca', 'prefiro', 'quando', 'voce', 'me', 'ou', 'e', 'a', 'o', 'as', 'os', 'se', 'mais']);

/**
 * Topico livre (`other:<slug>`) de uma preferencia sem topico conhecido: ate tres palavras do texto,
 * sem acento nem palavras vazias. Topico livre nunca entra em conflito automatico (research P2).
 */
export function makeFreeTopic(text: string): PreferenceTopic {
  const words = normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 3);
  const slug = words.join('-').slice(0, 40);
  return `other:${slug === '' ? 'geral' : slug}`;
}
