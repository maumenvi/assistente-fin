import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type SummaryContent } from '../../../domain/agent/summary/summary.content.ts';
import { type NamedEntity } from '../../../domain/preference/select/select.context.ts';
import { collectStream } from '../../../libs/llm/collect.stream.ts';
import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type LlmResult } from '../ports/llm/llm.result.ts';
import { allowedEntityIds, buildSummaryRequestText } from './merge.summary.ts';
import { parseSummaryJson } from './parse.summary.json.ts';
import { stripSummaryMoney } from './strip.summary.money.ts';
import { summaryContentSchema, validateSummary } from './validate.summary.ts';

/** Tempo maximo de uma chamada de resumo (spec 032, research P7). */
export const SUMMARY_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 700;

export type SummarizeResult =
  | { readonly ok: true; readonly content: SummaryContent; readonly calls: number; readonly usage: readonly NonNullable<LlmResult['usage']>[] }
  | { readonly ok: false; readonly reason: string; readonly calls: number };

/** Entrada do resumo incremental. */
export interface SummarizeInput {
  readonly llm: LlmPort;
  readonly system: string;
  readonly previous: SummaryContent | null;
  readonly block: readonly AgentMessage[];
  readonly accounts: readonly NamedEntity[];
  readonly categories: readonly NamedEntity[];
  readonly signal?: AbortSignal;
}

async function callOnce(input: SummarizeInput, messages: readonly LlmMessage[]): Promise<LlmResult> {
  const timeout = AbortSignal.timeout(SUMMARY_TIMEOUT_MS);
  const signal = input.signal === undefined ? timeout : AbortSignal.any([timeout, input.signal]);
  return collectStream(input.llm.stream({ system: input.system, messages: [...messages], temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS }, signal));
}

/**
 * Resumo incremental de um bloco (spec 032, research P7/P8): pede o JSON ao modelo, valida (forma,
 * sem valores em reais, ids do catalogo) e, se recusado, tenta UMA vez de novo dizendo a causa.
 * Persistindo valor monetario, remove os numeros (`[valor]`) e aceita so se o resto for valido.
 * Qualquer erro, tempo esgotado ou resumo invalido vira `ok:false` (o contexto cai no descarte seguro).
 */
export async function summarizeBlock(input: SummarizeInput): Promise<SummarizeResult> {
  const allowed = allowedEntityIds(input.accounts, input.categories, input.previous);
  const request: LlmMessage = { role: 'user', content: [{ type: 'text', text: buildSummaryRequestText(input) }] };
  const usage: NonNullable<LlmResult['usage']>[] = [];
  let calls = 0;
  let messages: LlmMessage[] = [request];
  let lastProblem = 'resumo indisponivel';
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await callOnce(input, messages);
      calls += 1;
      if (result.usage !== null) usage.push(result.usage);
      const raw = parseSummaryJson(result.text);
      const checked = validateSummary(raw, allowed);
      if (checked.ok) return { ok: true, content: checked.content, calls, usage };
      lastProblem = `${checked.problem}: ${checked.detail}`;
      if (checked.problem === 'money') {
        const shaped = summaryContentSchema.safeParse(raw);
        if (shaped.success && attempt === 1) {
          const stripped = validateSummary(stripSummaryMoney(shaped.data), allowed);
          if (stripped.ok) return { ok: true, content: stripped.content, calls, usage };
        }
      }
      messages = [
        request,
        { role: 'assistant', content: [{ type: 'text', text: result.text }] },
        { role: 'user', content: [{ type: 'text', text: `Resposta recusada (${checked.detail}). Corrija e responda SOMENTE com o JSON, sem valores em reais.` }] },
      ];
    }
    return { ok: false, reason: lastProblem, calls };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'falha ao resumir', calls };
  }
}
