import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';

/** Dependencias de `ConfigureModelsUseCase`. */
export interface ConfigureModelsDeps {
  readonly settings: AgentSettingsPort;
  readonly secrets: SecretStorePort;
  /** Servidor local so existe no desktop; no Android a borda passa `false`. */
  readonly allowLocal: boolean;
}
