import { type ModelRole } from '../../../domain/agent/model.role.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';
import { secretRefFor } from '../settings/secret.ref.ts';
import { type ModelProfile } from '../../../domain/agent/model.profile.ts';

export interface ReorderTiersInput {
  readonly userId: string;
  readonly rolesOrder: readonly [ModelRole, ModelRole, ModelRole];
}

export interface ReorderTiersDeps {
  readonly settings: AgentSettingsPort;
  readonly secrets: SecretStorePort;
}

const CANONICAL_ROLES: readonly ModelRole[] = ['main', 'fast', 'fallback'];

export class ReorderTiersUseCase {
  private readonly deps: ReorderTiersDeps;

  public constructor(deps: ReorderTiersDeps) {
    this.deps = deps;
  }

  public async execute(input: ReorderTiersInput): Promise<{ ok: boolean }> {
    const current = await this.deps.settings.read(input.userId);

    // Mapear cada perfil antigo com sua chave correspondente
    const oldProfilesWithKey = await Promise.all(
      current.profiles.map(async (p) => {
        const key = p.keyRef !== null ? await this.deps.secrets.get(p.keyRef) : null;
        return { profile: p, key };
      }),
    );

    const newProfiles = [];

    for (let i = 0; i < input.rolesOrder.length; i++) {
      const sourceOldRole = input.rolesOrder[i];
      const targetCanonicalRole = CANONICAL_ROLES[i] as ModelRole;

      const item = oldProfilesWithKey.find((x) => x.profile.role === sourceOldRole);
      if (!item) continue;

      newProfiles.push({
        id: targetCanonicalRole,
        role: targetCanonicalRole,
        origin: item.profile.origin,
        baseUrl: item.profile.baseUrl,
        model: item.profile.model,
        enabled: item.profile.enabled ?? true,
        apiKey: item.key ?? undefined,
        clearKey: item.key === null,
        capabilities: item.profile.capabilities,
      });
    }

    await this.deps.settings.write(input.userId, {
      profiles: newProfiles,
      localOnly: current.localOnly,
      limits: current.limits,
      routingStrategy: current.routingStrategy,
    });

    return { ok: true };
  }
}
