import { type ProviderDefinition } from './provider.definition.ts';

/** Google AI (Gemini) pela interface compativel com OpenAI (nenhum SDK). */
export const GOOGLE_PROVIDER: ProviderDefinition = {
  id: 'google',
  label: 'Google AI (Gemini)',
  tagline: 'Nuvem. Use a chave do Google AI Studio.',
  chip: 'Chave gratuita',
  origin: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  needsKey: true,
  keyLabel: 'Chave do Google AI Studio',
  keyPrefix: 'AIza',
  platforms: ['desktop', 'android'],
  preferredModels: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.0-flash'],
  autoModel: null,
  guideId: 'google',
  allowedHosts: ['aistudio.google.com', 'console.cloud.google.com'],
};
