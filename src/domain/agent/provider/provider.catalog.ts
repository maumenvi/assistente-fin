import { GOOGLE_PROVIDER } from './provider.google.ts';
import { type ProviderDefinition } from './provider.definition.ts';
import { type ProviderId } from './provider.id.ts';
import { OLLAMA_PROVIDER } from './provider.ollama.ts';
import { OPENROUTER_PROVIDER } from './provider.openrouter.ts';

/** Catalogo de provedores (FR-015): acrescentar um provedor compativel e acrescentar uma entrada aqui. */
export const PROVIDERS: Readonly<Record<ProviderId, ProviderDefinition>> = {
  openrouter: OPENROUTER_PROVIDER,
  google: GOOGLE_PROVIDER,
  ollama: OLLAMA_PROVIDER,
};
