import { type ModelOrigin } from '../../../domain/agent/model.origin.ts';
import { type ProviderDefinition } from '../../../domain/agent/provider/provider.definition.ts';

/** Rascunho ja resolvido contra o catalogo: endereco, origem e chave efetivos. */
export interface ResolvedDraft {
  /** `null` = servidor proprio (`custom`). */
  readonly provider: ProviderDefinition | null;
  readonly origin: ModelOrigin;
  readonly baseUrl: string;
  readonly needsKey: boolean;
  readonly apiKey: string | undefined;
  readonly model: string | undefined;
}
