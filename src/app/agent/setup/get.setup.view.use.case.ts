import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { detectProvider } from '../../../domain/agent/provider/detect.provider.ts';
import { listProvidersFor } from '../../../domain/agent/provider/list.providers.for.ts';
import { PROVIDERS } from '../../../domain/agent/provider/provider.catalog.ts';
import { toAgentSettingsView } from '../settings/to.agent.settings.view.ts';
import { CLOUD_CONSENT_VERSION } from '../settings/cloud.consent.version.ts';
import { isDefaultFamilyModel } from './is.default.family.model.ts';
import { type SetupDeps } from './setup.deps.ts';
import { type SetupView } from './setup.view.ts';

/**
 * Estado da tela simples a partir dos perfis existentes (spec 035, FR-014): o provedor e DEDUZIDO do perfil principal
 * (nada e regravado), e o modelo diferente do padrao aparece como personalizado. Sem perfil, abre no provedor recomendado.
 */
export class GetSetupViewUseCase {
  private readonly deps: SetupDeps;

  public constructor(deps: SetupDeps) {
    this.deps = deps;
  }

  public async execute(userId: string): Promise<SetupView> {
    const [settings, consent] = await Promise.all([this.deps.settings.read(userId), this.deps.settings.readConsent(userId)]);
    const main: ModelProfile | undefined = settings.profiles.find((p) => p.role === 'main' && p.enabled);
    const withKey = new Set<string>();
    for (const profile of settings.profiles) {
      if (profile.keyRef !== null && (await this.deps.secrets.get(profile.keyRef)) !== null) withKey.add(profile.keyRef);
    }
    const provider = main === undefined ? 'openrouter' : detectProvider(main);
    const definition = provider === 'custom' ? null : PROVIDERS[provider];
    const providers = listProvidersFor(this.deps.platform, { localOnly: settings.localOnly }).map(({ provider: p, disabledReason }) => ({
      id: p.id,
      label: p.label,
      tagline: p.tagline,
      chip: p.chip,
      needsKey: p.needsKey,
      keyLabel: p.keyLabel,
      defaultModel: p.autoModel ?? p.preferredModels[0] ?? null,
      disabledReason,
    }));
    return {
      provider,
      providers,
      model: main?.model ?? null,
      isCustomModel: main !== undefined && (definition === null || !isDefaultFamilyModel(definition, main.model)),
      hasKey: main?.keyRef != null && withKey.has(main.keyRef),
      configured: main !== undefined,
      localOnly: settings.localOnly,
      consentGiven: consent?.textVersion === CLOUD_CONSENT_VERSION,
      advanced: toAgentSettingsView(settings, (ref) => withKey.has(ref)),
    };
  }
}
