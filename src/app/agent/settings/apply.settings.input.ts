import { CONSERVATIVE_CAPABILITIES } from '../../../domain/agent/conservative.capabilities.ts';
import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { type AgentSettings } from '../ports/settings/agent.settings.ts';
import { type AgentSettingsInput } from '../ports/settings/agent.settings.input.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';
import { secretRefFor } from './secret.ref.ts';

/**
 * Aplica o que a tela enviou sobre a configuracao guardada (spec 031, contracts/settings.contract.md),
 * comum a todas as bordas:
 * - a chave (`apiKey`) vai para o cofre e o perfil guarda so `keyRef`; sem `apiKey`, a chave
 *   guardada e mantida;
 * - as capacidades verificadas so sobrevivem se endereco e modelo nao mudaram (senao voltam ao
 *   conservador ate nova sonda), a menos que a tela as envie;
 * - perfis removidos tem a chave apagada do cofre.
 */
export async function applySettingsInput(
  userId: string,
  current: AgentSettings,
  input: AgentSettingsInput,
  secrets: SecretStorePort,
): Promise<AgentSettings> {
  const profiles: ModelProfile[] = [];
  for (const item of input.profiles) {
    const existing = current.profiles.find((p) => p.id === item.id);
    let keyRef = existing?.keyRef ?? null;
    if (item.clearKey === true && item.apiKey === undefined) {
      keyRef = null;
    } else if (item.apiKey !== undefined) {
      keyRef = keyRef ?? secretRefFor(userId, item.id);
      await secrets.set(keyRef, item.apiKey);
    }
    const unchanged = existing !== undefined && existing.baseUrl === item.baseUrl && existing.model === item.model;
    const { apiKey: _apiKey, clearKey: _clearKey, capabilities, ...rest } = item;
    profiles.push({
      ...rest,
      keyRef,
      capabilities: capabilities ?? (unchanged ? existing.capabilities : CONSERVATIVE_CAPABILITIES),
    });
  }
  for (const old of current.profiles) {
    if (old.keyRef !== null && !profiles.some((p) => p.keyRef === old.keyRef)) await secrets.delete(old.keyRef);
  }
  const nextStrategy = input.routingStrategy ?? current.routingStrategy;
  return {
    profiles,
    localOnly: input.localOnly,
    limits: input.limits,
    ...(nextStrategy !== undefined ? { routingStrategy: nextStrategy } : {}),
  };
}
