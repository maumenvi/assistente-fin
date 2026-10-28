import { type ProviderDefinition } from './provider.definition.ts';

/** Ollama neste computador (servidor local; so desktop; nada sai da maquina). */
export const OLLAMA_PROVIDER: ProviderDefinition = {
  id: 'ollama',
  label: 'Ollama (neste computador)',
  tagline: 'Privado: roda no seu computador, sem chave e sem enviar dados.',
  chip: 'Privado',
  origin: 'openai_compat_local',
  baseUrl: 'http://localhost:11434/v1',
  needsKey: false,
  keyLabel: '',
  keyPrefix: null,
  platforms: ['desktop'],
  preferredModels: ['qwen3:8b', 'gpt-oss:20b', 'llama3.1:8b', 'mistral-small'],
  autoModel: null,
  guideId: 'ollama',
  allowedHosts: ['ollama.com'],
};
