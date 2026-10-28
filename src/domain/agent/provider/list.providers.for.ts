import { PROVIDERS } from './provider.catalog.ts';
import { type ProviderChoice } from './provider.choice.ts';
import { type ProviderPlatform } from './provider.platform.ts';

/**
 * Provedores oferecidos numa plataforma (o Android nunca recebe o Ollama). Com "somente local" ligado,
 * a nuvem aparece desabilitada com `local_only` (regra de privacidade da spec 031).
 */
export function listProvidersFor(platform: ProviderPlatform, options: { readonly localOnly: boolean }): readonly ProviderChoice[] {
  return Object.values(PROVIDERS)
    .filter((provider) => provider.platforms.includes(platform))
    .map((provider) => ({ provider, disabledReason: options.localOnly && provider.origin !== 'openai_compat_local' ? ('local_only' as const) : null }));
}
