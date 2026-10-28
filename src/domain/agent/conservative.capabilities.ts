import { type ModelCapabilities } from './model.capabilities.ts';

/** Capacidades assumidas para um modelo desconhecido: sem ferramentas e contexto pequeno. */
export const CONSERVATIVE_CAPABILITIES: ModelCapabilities = Object.freeze({
  tools: false,
  parallelToolCalls: false,
  vision: false,
  structuredOutput: false,
  contextWindow: 8000,
  promptCache: 'none',
  reasoning: false,
  verifiedAt: null,
});
