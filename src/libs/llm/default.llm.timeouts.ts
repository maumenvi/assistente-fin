import { type LlmTimeouts } from './llm.timeouts.ts';

/** Conexao 15 s, primeiro conteudo 90 s, silencio entre eventos 45 s (modelos que "pensam", como o Gemini 4, demoram antes do primeiro token com contexto grande). */
export const DEFAULT_LLM_TIMEOUTS: LlmTimeouts = Object.freeze({
  connectMs: 15_000,
  firstContentMs: 90_000,
  idleMs: 45_000,
});
