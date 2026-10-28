import { z } from 'zod';
import { LocalOnlyViolationError } from '../../../domain/agent/errors/local.only.violation.error.ts';
import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { requiresCloudConsent } from '../../../domain/agent/requires.cloud.consent.ts';
import { listModels, listedModelCapabilities, type ListedModel } from '../../../libs/llm/openai-compat/list.models.ts';
import { probeToolSupport } from '../../../libs/llm/openai-compat/probe.tool.support.ts';
import { resolveCapabilities } from '../../../libs/llm/resolve.capabilities.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type ConnectionTestResult } from './connection.test.result.ts';
import { mapConnectionError } from './map.connection.error.ts';
import { type TestConnectionDeps } from './test.connection.deps.ts';
import { testConnectionInputSchema } from './test.connection.input.schema.ts';

/** Prazo de cada chamada do teste: servidor que nao responde nao trava a tela. */
const CALL_TIMEOUT_MS = 20_000;

const NO_TOOLS_WARNING = 'Este modelo não usa ferramentas de forma confiável: o assistente só conseguirá conversar, sem consultar os seus dados.';

/**
 * Teste de conexao de um perfil (spec 031, T099, contracts/settings.contract.md): valida o perfil
 * salvo, lista os modelos do servidor (quando ele oferece), roda a sonda de ferramentas e GRAVA
 * `capabilities` + `verifiedAt` no perfil. Nenhum dado do usuario sai - a sonda e um "ping" fixo.
 * Perfil de nuvem com "somente local" ligado e recusado. A chave vem do cofre e nunca aparece no
 * resultado.
 */
export class TestConnectionUseCase {
  private readonly deps: TestConnectionDeps;

  public constructor(deps: TestConnectionDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<ConnectionTestResult> {
    const parsed = testConnectionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('testar conexao', flat.fieldErrors, flat.formErrors);
    }
    const { userId, profileId } = parsed.data;
    const settings = await this.deps.settings.read(userId);
    const profile = settings.profiles.find((p) => p.id === profileId);
    if (profile === undefined) throw new InvalidInputError('testar conexao', { profileId: ['perfil nao encontrado'] });
    if (settings.localOnly && requiresCloudConsent(profile.origin)) throw new LocalOnlyViolationError();

    const apiKey = profile.keyRef === null ? undefined : ((await this.deps.secrets.get(profile.keyRef)) ?? undefined);
    if (requiresCloudConsent(profile.origin) && apiKey === undefined) {
      return { ok: false, latencyMs: 0, error: 'invalid_key', capabilities: null, warnings: [] };
    }
    const common = {
      baseUrl: profile.baseUrl,
      ...(apiKey === undefined ? {} : { apiKey }),
      fetchFn: this.deps.fetchFn,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    };
    const startedAt = this.deps.clock.now().getTime();
    try {
      const listed = await listModels(common);
      const known: ListedModel | undefined = listed.find((m) => m.id === profile.model);
      if (listed.length > 0 && known === undefined) {
        return { ok: false, latencyMs: this.deps.clock.now().getTime() - startedAt, error: 'model_unavailable', capabilities: null, warnings: [] };
      }
      const probe = await probeToolSupport({ ...common, model: profile.model });
      const capabilities: ModelCapabilities = resolveCapabilities({
        modelId: profile.model,
        ...(known === undefined ? {} : { listing: listedModelCapabilities(known) }),
        probe: { tools: probe.supportsTools, verifiedAt: this.deps.clock.now().toISOString() },
      });
      await this.deps.settings.write(userId, {
        profiles: settings.profiles.map((p) => ({ ...p, ...(p.id === profile.id ? { capabilities } : {}) })),
        localOnly: settings.localOnly,
        limits: settings.limits,
      });
      return { ok: true, latencyMs: probe.latencyMs, capabilities, warnings: probe.supportsTools ? [] : [NO_TOOLS_WARNING] };
    } catch (error) {
      return {
        ok: false,
        latencyMs: this.deps.clock.now().getTime() - startedAt,
        error: mapConnectionError(error, profile.origin),
        capabilities: null,
        warnings: [],
      };
    }
  }
}
