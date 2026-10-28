import { z } from 'zod';
import { listModels } from '../../../libs/llm/openai-compat/list.models.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AvailableModelsResult } from './available.models.result.ts';
import { mapConnectionError } from './map.connection.error.ts';
import { type TestConnectionDeps } from './test.connection.deps.ts';
import { listAvailableModelsInputSchema } from './list.available.models.input.schema.ts';

/** Prazo da consulta: servidor que nao responde nao trava a tela. */
const CALL_TIMEOUT_MS = 20_000;

/** Quantos modelos no maximo a tela recebe (o OpenRouter lista centenas). */
const MAX_MODELS = 500;

/**
 * Modelos que o servidor do perfil oferece (spec 031, T101), para a tela escolher (servidor local e
 * OpenRouter). Erro de rede/chave nao lanca: volta como `error` (`local_unreachable`, `offline`,
 * `invalid_key`...) com a lista vazia. A chave vem do cofre e nunca aparece no resultado.
 */
export class ListAvailableModelsUseCase {
  private readonly deps: TestConnectionDeps;

  public constructor(deps: TestConnectionDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<AvailableModelsResult> {
    const parsed = listAvailableModelsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar modelos disponiveis', flat.fieldErrors, flat.formErrors);
    }
    const { userId, profileId } = parsed.data;
    const settings = await this.deps.settings.read(userId);
    const profile = settings.profiles.find((p) => p.id === profileId);
    if (profile === undefined) throw new InvalidInputError('listar modelos disponiveis', { profileId: ['perfil nao encontrado'] });
    const apiKey = profile.keyRef === null ? undefined : ((await this.deps.secrets.get(profile.keyRef)) ?? undefined);
    try {
      const listed = await listModels({
        baseUrl: profile.baseUrl,
        ...(apiKey === undefined ? {} : { apiKey }),
        fetchFn: this.deps.fetchFn,
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      return {
        models: listed.slice(0, MAX_MODELS).map((m) => ({
          id: m.id,
          ...(m.contextWindow === null ? {} : { contextWindow: m.contextWindow }),
          ...(m.supportsTools === null ? {} : { supportsTools: m.supportsTools }),
        })),
        error: null,
      };
    } catch (error) {
      return { models: [], error: mapConnectionError(error, profile.origin) };
    }
  }
}
