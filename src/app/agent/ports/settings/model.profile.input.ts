import { type ModelCapabilities } from '../../../../domain/agent/model.capabilities.ts';
import { type ModelProfile } from '../../../../domain/agent/model.profile.ts';

/**
 * Perfil como chega da tela: a chave so entra aqui (`apiKey`); o servico a guarda no cofre e grava
 * apenas `keyRef` no perfil. Sem `apiKey`, a chave ja guardada e mantida.
 */
export type ModelProfileInput = Omit<ModelProfile, 'keyRef' | 'capabilities'> & {
  readonly apiKey?: string | undefined;
  readonly clearKey?: boolean | undefined;
  readonly capabilities?: ModelCapabilities | undefined;
};
