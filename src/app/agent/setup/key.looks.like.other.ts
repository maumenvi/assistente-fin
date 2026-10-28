import { PROVIDERS } from '../../../domain/agent/provider/provider.catalog.ts';
import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';

/** Se a chave tem o prefixo de OUTRO provedor (e nao o do escolhido), devolve o nome desse provedor; senao `null`. */
export function keyLooksLikeOther(provider: ProviderId | 'custom', apiKey: string): string | null {
  const own = provider === 'custom' ? null : PROVIDERS[provider].keyPrefix;
  if (own !== null && apiKey.startsWith(own)) return null;
  for (const other of Object.values(PROVIDERS)) {
    if (other.id === provider || other.keyPrefix === null) continue;
    if (apiKey.startsWith(other.keyPrefix)) return other.label;
  }
  return null;
}
