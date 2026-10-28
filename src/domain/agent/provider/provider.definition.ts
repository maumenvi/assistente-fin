import { type ModelOrigin } from '../model.origin.ts';
import { type ProviderId } from './provider.id.ts';
import { type ProviderPlatform } from './provider.platform.ts';

/** Um provedor do catalogo (spec 035, data-model.md 2): constante empacotada, nunca gravada. */
export interface ProviderDefinition {
  readonly id: ProviderId;
  readonly label: string;
  readonly tagline: string;
  readonly chip: string;
  /** Origem do perfil gravado (`ollama` -> `openai_compat_local`). */
  readonly origin: ModelOrigin;
  readonly baseUrl: string;
  readonly needsKey: boolean;
  readonly keyLabel: string;
  /** Prefixo esperado da chave (aviso "parece uma chave do X"); `null` = sem prefixo conhecido. */
  readonly keyPrefix: string | null;
  readonly platforms: readonly ProviderPlatform[];
  /** Ids em ordem de preferencia; a sonda e a listagem decidem qual entra. */
  readonly preferredModels: readonly string[];
  /** OpenRouter: roteador automatico, so entra se a sonda passar. */
  readonly autoModel: string | null;
  readonly guideId: ProviderId;
  /** Hosts permitidos nos links do guia. */
  readonly allowedHosts: readonly string[];
}
