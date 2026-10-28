import { type Clock } from '../../shared/clock.port.ts';
import { type FetchFn } from '../../../libs/llm/fetch.fn.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';

/** Dependencias de `TestConnectionUseCase`. */
export interface TestConnectionDeps {
  readonly settings: AgentSettingsPort;
  readonly secrets: SecretStorePort;
  readonly fetchFn: FetchFn;
  readonly clock: Clock;
}
