import { LocalOnlyViolationError } from '../../../domain/agent/errors/local.only.violation.error.ts';
import { PROVIDERS } from '../../../domain/agent/provider/provider.catalog.ts';
import { requiresCloudConsent } from '../../../domain/agent/requires.cloud.consent.ts';
import { isLocalBaseUrl } from '../../../libs/llm/is.local.base.url.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { baseUrlSchema } from '../settings/base.url.schema.ts';
import { secretRefFor } from '../settings/secret.ref.ts';
import { cleanApiKey } from './clean.api.key.ts';
import { type ResolvedDraft } from './resolved.draft.ts';
import { type SetupDeps } from './setup.deps.ts';
import { type TestSetupInput } from './test.setup.input.ts';

/**
 * Resolve o rascunho contra o catalogo e a configuracao: plataforma permitida, "somente local", endereco valido e a
 * chave efetiva (a do rascunho, limpa; senao a ja guardada no cofre). Nao grava nada.
 */
export async function resolveDraft(deps: SetupDeps, input: TestSetupInput): Promise<ResolvedDraft> {
  const { draft } = input;
  const provider = draft.provider === 'custom' ? null : PROVIDERS[draft.provider];
  if (provider !== null && !provider.platforms.includes(deps.platform)) {
    throw new InvalidInputError('testar configuracao', { provider: [`${provider.label} nao existe neste aparelho`] });
  }
  const rawUrl = draft.baseUrl ?? (provider === null ? undefined : (deps.urlOverrides?.[provider.id] ?? provider.baseUrl));
  const parsedUrl = baseUrlSchema.safeParse(rawUrl ?? '');
  if (!parsedUrl.success) throw new InvalidInputError('testar configuracao', { baseUrl: ['endereco invalido: use https:// (http:// so para localhost)'] });
  const baseUrl = parsedUrl.data;
  const origin = provider !== null ? provider.origin : isLocalBaseUrl(baseUrl) ? 'openai_compat_local' : 'openrouter';
  if (deps.platform === 'android' && origin === 'openai_compat_local') {
    throw new InvalidInputError('testar configuracao', { baseUrl: ['servidor local so existe no computador (desktop)'] });
  }
  const settings = await deps.settings.read(input.userId);
  if (settings.localOnly && requiresCloudConsent(origin)) throw new LocalOnlyViolationError();
  const needsKey = requiresCloudConsent(origin);
  const saved = needsKey ? await deps.secrets.get(secretRefFor(input.userId, input.role ?? 'main')) : null;
  const apiKey = needsKey ? (cleanApiKey(draft.apiKey) ?? cleanApiKey(saved ?? undefined)) : undefined;
  const model = draft.model?.trim() === '' ? undefined : draft.model?.trim();
  return { provider, origin, baseUrl, needsKey, apiKey, model };
}
