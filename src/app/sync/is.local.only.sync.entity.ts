import { LOCAL_ONLY_SYNC_ENTITIES } from './local.only.sync.entities.ts';
import { type SyncEntity } from './sync.entity.ts';
import { type AgentSettingsPort } from '../agent/ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../agent/ports/settings/secret.store.port.ts';
import { type SyncAgentModelProfile } from '../../domain/agent/model.profile.ts';

/** `true` para entidades que ficam so no celular e nunca entram na sincronizacao (spec 027, FR-011). */
export function isLocalOnlySyncEntity(entity: SyncEntity | string): boolean {
  return (LOCAL_ONLY_SYNC_ENTITIES as readonly string[]).includes(entity);
}

/** `true` para perfis que rodam apenas localmente no desktop (Ollama, LM Studio) e NÃO sincronizam com celular (spec 039, FR-007). */
export function isLocalOnlyModelProfile(profile: { readonly origin: string }): boolean {
  return profile.origin === 'openai_compat_local';
}

/** `true` se a origem do modelo é baseada em nuvem e apta para sincronização segura com o mobile (spec 039, FR-007). */
export function isSyncableModelOrigin(origin: string): boolean {
  return origin === 'google' || origin === 'openrouter';
}

/**
 * Resolve e empacota os perfis sincronizáveis para o celular com suas credenciais seguras (spec 039, FR-007).
 * Perfis locais (Ollama) são estritamente omitidos.
 */
export async function resolveSyncableAgentProfiles(
  settings: AgentSettingsPort,
  secrets: SecretStorePort,
  userId: string,
): Promise<readonly SyncAgentModelProfile[]> {
  const current = await settings.read(userId);
  const syncable: SyncAgentModelProfile[] = [];
  for (const profile of current.profiles) {
    if (isLocalOnlyModelProfile(profile) || !isSyncableModelOrigin(profile.origin)) continue;
    const apiKey = profile.keyRef !== null ? (await secrets.get(profile.keyRef)) ?? undefined : undefined;
    syncable.push({
      id: profile.id,
      role: profile.role,
      origin: profile.origin as 'google' | 'openrouter',
      baseUrl: profile.baseUrl,
      model: profile.model,
      apiKey,
      enabled: profile.enabled,
      updatedAt: profile.capabilities?.verifiedAt ?? undefined,
    });
  }
  return syncable;
}
