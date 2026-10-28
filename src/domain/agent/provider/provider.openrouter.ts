import { type ProviderDefinition } from './provider.definition.ts';

/** OpenRouter: uma chave, varios modelos (nuvem). */
export const OPENROUTER_PROVIDER: ProviderDefinition = {
  id: 'openrouter',
  label: 'OpenRouter',
  tagline: 'Nuvem. Uma chave dá acesso a vários modelos; o app escolhe um que funciona.',
  chip: 'Recomendado',
  origin: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  needsKey: true,
  keyLabel: 'Chave do OpenRouter',
  keyPrefix: 'sk-or-',
  platforms: ['desktop', 'android'],
  preferredModels: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 'meta-llama/llama-3.3-70b-instruct'],
  autoModel: 'openrouter/auto',
  guideId: 'openrouter',
  allowedHosts: ['openrouter.ai'],
};
