import { LlmAuthError } from '../../../domain/agent/errors/llm.auth.error.ts';
import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { requiresCloudConsent } from '../../../domain/agent/requires.cloud.consent.ts';
import { OpenAiCompatLlm } from '../../../libs/llm/openai-compat/openai.compat.llm.ts';
import { resolveCapabilities } from '../../../libs/llm/resolve.capabilities.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type CreateLlmPortDeps } from './create.llm.port.deps.ts';
import { withUserTurnLast } from './with.user.turn.last.ts';

/**
 * Monta o adaptador de um perfil SEM conferir privacidade (quem chama ja conferiu: `createLlmPort`
 * ou `buildRoleLlms`). Resolve a chave no cofre e as capacidades (verificadas pela sonda, ou os
 * presets da familia do modelo).
 */
export async function buildLlmPort(
  profile: ModelProfile,
  deps: Pick<CreateLlmPortDeps, 'secrets' | 'fetchFn' | 'adapter'>,
): Promise<LlmPort> {
  const apiKey = profile.keyRef === null ? undefined : ((await deps.secrets.get(profile.keyRef)) ?? undefined);
  if (requiresCloudConsent(profile.origin) && apiKey === undefined) throw new LlmAuthError();
  const capabilities = profile.capabilities.verifiedAt !== null ? profile.capabilities : resolveCapabilities({ modelId: profile.model });
  return withUserTurnLast(new OpenAiCompatLlm({
    baseUrl: profile.baseUrl,
    model: profile.model,
    origin: profile.origin,
    ...(apiKey !== undefined ? { apiKey } : {}),
    capabilities,
    fetchFn: deps.fetchFn,
    ...deps.adapter,
  }));
}
