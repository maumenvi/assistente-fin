import { PROVIDERS } from './provider.catalog.ts';
import { type ProviderId } from './provider.id.ts';

/** Lista curta de modelos conhecidos de um provedor, em ordem de preferencia (a sonda decide qual passa). */
export function recommendedModels(provider: ProviderId): readonly string[] {
  return PROVIDERS[provider].preferredModels;
}
