import { MemoryAgentSettings } from '../../../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../../../src/app/agent/settings/memory.secret.store.ts';
import { ClearSetupKeyUseCase } from '../../../../../src/app/agent/setup/clear.setup.key.use.case.ts';
import { GetSetupViewUseCase } from '../../../../../src/app/agent/setup/get.setup.view.use.case.ts';
import { SaveSetupUseCase } from '../../../../../src/app/agent/setup/save.setup.use.case.ts';
import { TestSetupUseCase } from '../../../../../src/app/agent/setup/test.setup.use.case.ts';
import { type SetupDeps } from '../../../../../src/app/agent/setup/setup.deps.ts';
import { type ProviderId } from '../../../../../src/domain/agent/provider/provider.id.ts';
import { type ProviderPlatform } from '../../../../../src/domain/agent/provider/provider.platform.ts';
import { FixedClock } from '../../../../support/fixed.clock.ts';
import { startFakeProvider, type FakeProvider, type FakeProviderOptions } from '../../../../support/fake.provider.servers.ts';

export const NOW = new Date('2026-10-23T12:00:00Z');
export const USER = 'u1';

/** Mundo de teste do assistente simples: provedor de mentira + cofre/configuracao em memoria + casos de uso. */
export interface SetupWorld {
  readonly server: FakeProvider;
  readonly secrets: MemorySecretStore;
  readonly settings: MemoryAgentSettings;
  readonly deps: SetupDeps;
  readonly test: TestSetupUseCase;
  readonly save: SaveSetupUseCase;
  readonly getView: GetSetupViewUseCase;
  readonly clearKey: ClearSetupKeyUseCase;
  close(): Promise<void>;
}

/** Sobe um provedor de mentira e liga os casos de uso a ele (o endereco do provedor vira o override do catalogo). */
export async function startSetupWorld(options: FakeProviderOptions & { readonly platform?: ProviderPlatform }): Promise<SetupWorld> {
  const server = await startFakeProvider(options);
  const secrets = new MemorySecretStore();
  const settings = new MemoryAgentSettings(secrets);
  const provider: ProviderId = options.kind;
  const deps: SetupDeps = { settings, secrets, fetchFn: fetch, clock: new FixedClock(NOW), platform: options.platform ?? 'desktop', urlOverrides: { [provider]: server.baseUrl } };
  return { server, secrets, settings, deps, test: new TestSetupUseCase(deps), save: new SaveSetupUseCase(deps), getView: new GetSetupViewUseCase(deps), clearKey: new ClearSetupKeyUseCase(deps), close: () => server.close() };
}
