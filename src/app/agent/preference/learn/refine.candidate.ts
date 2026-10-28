import { stripMoneyFigures } from '../../../../domain/agent/summary/strip.money.figures.ts';
import { normalizeText } from '../../../../domain/preference/normalize.text.ts';
import { checkPreferenceText } from '../../../../domain/preference/guard/check.preference.text.ts';
import { collectStream } from '../../../../libs/llm/collect.stream.ts';
import { type LlmPort } from '../../ports/llm/llm.port.ts';

/** Tempo maximo do refino (spec 032, research P3): passou disso, fica o texto-padrao. */
const REFINE_TIMEOUT_MS = 5000;
const MAX_SNIPPETS = 3;
const MAX_SNIPPET_LENGTH = 120;

const SYSTEM = [
  'Você reescreve uma preferência de uso de um assistente financeiro.',
  'Receba até 3 trechos curtos escritos pelo usuário e a preferência atual e devolva UMA frase curta, em português do Brasil, na forma de instrução (ex.: "Responder de forma curta.").',
  'Não inclua valores em reais, dados pessoais, links nem explicações. Responda só com a frase.',
].join('\n');

/**
 * Refino OPCIONAL da redacao de uma candidata (aprendizado hibrido, clarificacao 2026-10-22): as
 * regras locais ja acharam o padrao; o modelo so melhora a frase. Entrada: ate 3 trechos do proprio
 * usuario, curtos e sem valores. Saida validada com as mesmas regras do chat; qualquer falha, tempo
 * esgotado ou texto invalido devolve `null` (fica o texto-padrao).
 */
export async function refineCandidate(llm: LlmPort, currentText: string, userSnippets: readonly string[], parentSignal?: AbortSignal): Promise<string | null> {
  const snippets = userSnippets
    .map((s) => stripMoneyFigures(s).replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_LENGTH))
    .filter((s) => s !== '')
    .slice(0, MAX_SNIPPETS);
  if (snippets.length === 0) return null;
  const timeout = AbortSignal.timeout(REFINE_TIMEOUT_MS);
  const signal = parentSignal === undefined ? timeout : AbortSignal.any([timeout, parentSignal]);
  try {
    const result = await collectStream(
      llm.stream(
        {
          system: SYSTEM,
          messages: [{ role: 'user', content: [{ type: 'text', text: `Preferência atual: ${currentText}\nTrechos do usuário:\n${snippets.map((s) => `- ${s}`).join('\n')}` }] }],
          temperature: 0,
          maxOutputTokens: 60,
        },
        signal,
      ),
    );
    const refined = result.text.trim().replace(/^["“]|["”]$/g, '').split('\n')[0]?.trim() ?? '';
    return refined !== '' && checkPreferenceText(refined) === null && sharesMeaning(refined, currentText) ? refined : null;
  } catch {
    return null;
  }
}

/** Radicais (4 letras) das palavras de 4+ letras: "respostas" e "responder" compartilham "resp". */
function stems(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter((w) => w.length >= 4).map((w) => w.slice(0, 4)));
}

/**
 * A frase refinada precisa tratar do mesmo assunto da candidata (divide ao menos um radical com o
 * texto-padrao): evita aceitar como preferencia uma resposta qualquer do modelo.
 */
function sharesMeaning(refined: string, current: string): boolean {
  const base = stems(current);
  for (const stem of stems(refined)) if (base.has(stem)) return true;
  return false;
}
