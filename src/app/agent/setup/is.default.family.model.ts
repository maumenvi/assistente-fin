import { type ProviderDefinition } from '../../../domain/agent/provider/provider.definition.ts';

/** O modelo e o padrao do provedor (o auto ou um da lista curta; no Ollama, da mesma familia)? */
export function isDefaultFamilyModel(provider: ProviderDefinition, model: string): boolean {
  if (model === provider.autoModel) return true;
  return provider.preferredModels.some((preferred) => preferred === model || (provider.origin === 'openai_compat_local' && model.startsWith(`${preferred.split(':')[0] as string}:`)));
}
