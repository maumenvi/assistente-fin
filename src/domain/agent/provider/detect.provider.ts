import { type ModelOrigin } from '../model.origin.ts';
import { PROVIDERS } from './provider.catalog.ts';
import { type ProviderId } from './provider.id.ts';

function hostOf(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).host;
  } catch {
    return null;
  }
}

/**
 * Deduz o provedor de um perfil existente (migracao sem perda, FR-014): nao grava nada e nunca lanca.
 * Servidor desconhecido (endereco proprio) => `custom`.
 */
export function detectProvider(profile: { readonly origin: ModelOrigin; readonly baseUrl: string }): ProviderId | 'custom' {
  const host = hostOf(profile.baseUrl);
  for (const provider of Object.values(PROVIDERS)) {
    if (provider.origin !== profile.origin) continue;
    if (provider.origin === 'openai_compat_local') {
      if (host === hostOf(provider.baseUrl)) return provider.id;
      continue;
    }
    return provider.id;
  }
  return 'custom';
}
