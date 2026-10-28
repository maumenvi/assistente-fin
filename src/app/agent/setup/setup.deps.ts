import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';
import { type ProviderPlatform } from '../../../domain/agent/provider/provider.platform.ts';
import { type FetchFn } from '../../../libs/llm/fetch.fn.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';

/** Dependencias de `TestSetupUseCase` e `SaveSetupUseCase` (spec 035). */
export interface SetupDeps {
  readonly settings: AgentSettingsPort;
  readonly secrets: SecretStorePort;
  readonly fetchFn: FetchFn;
  readonly clock: Clock;
  /** Plataforma da borda: o Ollama so existe no `desktop`. */
  readonly platform: ProviderPlatform;
  /** Enderecos de teste por provedor (so e2e; vazio em producao). */
  readonly urlOverrides?: Readonly<Partial<Record<ProviderId, string | undefined>>> | undefined;
}
