import { type ModelCapabilities } from '../../domain/agent/model.capabilities.ts';

/** Familias conhecidas: o que se espera delas ate a sonda confirmar (`tools` aqui e so uma expectativa). */
const FAMILIES: readonly { readonly match: RegExp; readonly capabilities: Partial<ModelCapabilities> }[] = [
  {
    match: /claude/i,
    capabilities: {
      tools: true, parallelToolCalls: true, vision: true, structuredOutput: true,
      contextWindow: 200_000, promptCache: 'explicit', reasoning: true,
    },
  },
  // roteador automatico do OpenRouter: so entra como padrao se a sonda confirmar ferramentas (spec 035, R2)
  {
    match: /^openrouter\/auto$/i,
    capabilities: { tools: true, parallelToolCalls: true, structuredOutput: false, contextWindow: 128_000 },
  },
  {
    match: /gemini/i,
    capabilities: {
      tools: true, parallelToolCalls: true, vision: true, structuredOutput: true,
      contextWindow: 1_000_000, promptCache: 'implicit', reasoning: true,
    },
  },
  {
    match: /(^|\/)(gpt-|o\d)/i,
    capabilities: {
      tools: true, parallelToolCalls: true, vision: true, structuredOutput: true,
      contextWindow: 128_000, promptCache: 'implicit',
    },
  },
  { match: /llama|qwen|mistral|gemma|phi/i, capabilities: { contextWindow: 32_000 } },
];

/** Capacidades esperadas para o id de um modelo (parcial; vazio se a familia e desconhecida). */
export function presetCapabilities(modelId: string): Partial<ModelCapabilities> {
  for (const family of FAMILIES) {
    if (family.match.test(modelId)) return family.capabilities;
  }
  return {};
}
