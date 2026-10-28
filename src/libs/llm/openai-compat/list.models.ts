import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type FetchFn } from '../fetch.fn.ts';
import { mapHttpError } from './map.http.error.ts';
import { mapNetworkError } from './map.network.error.ts';
import { normalizeModelId } from './google.quirks.ts';
import { modelsSchema } from './models.schema.ts';

/** Modelo listado pelo servidor, com o que da para inferir. `null` = o servidor nao informa. */
export interface ListedModel {
  readonly id: string;
  readonly contextWindow: number | null;
  readonly supportsTools: boolean | null;
  readonly supportsStructuredOutput: boolean | null;
  readonly vision: boolean | null;
  /** Preco por token, em dolares. */
  readonly promptPriceUsd: number | null;
  readonly completionPriceUsd: number | null;
}

/** Cache de listas por `baseUrl` (24 h). */
export type ModelListCache = Map<string, { readonly at: number; readonly models: readonly ListedModel[] }>;

/** Validade do cache: 24 horas. */
export const MODEL_LIST_TTL_MS = 24 * 60 * 60 * 1000;

export interface ListModelsParams {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly fetchFn: FetchFn;
  readonly cache?: ModelListCache;
  /** Relogio em ms (injetavel). */
  readonly nowMs?: () => number;
  readonly signal?: AbortSignal;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * `GET {baseUrl}/models` (spec 031, D6). Devolve a lista (do cache se tiver menos de 24 h).
 * Servidor sem `/models` (404) devolve lista vazia; chave invalida, erro de servidor e rede
 * lancam o erro de dominio para a UI mostrar o motivo.
 */
export async function listModels(params: ListModelsParams): Promise<readonly ListedModel[]> {
  const nowMs = params.nowMs ?? Date.now;
  const key = params.baseUrl.replace(/\/+$/, '');
  const cached = params.cache?.get(key);
  if (cached && nowMs() - cached.at < MODEL_LIST_TTL_MS) return cached.models;
  let response: Response;
  try {
    response = await params.fetchFn(`${key}/models`, {
      method: 'GET',
      headers: params.apiKey ? { authorization: `Bearer ${params.apiKey}` } : {},
      ...(params.signal ? { signal: params.signal } : {}),
    });
  } catch (error) {
    throw mapNetworkError(error, false);
  }
  if (response.status === 404) return [];
  if (!response.ok) {
    throw mapHttpError({
      status: response.status,
      bodyText: await response.text().catch(() => ''),
      retryAfterHeader: response.headers.get('retry-after'),
      now: new Date(nowMs()),
      emittedContent: false,
    });
  }
  const parsed = modelsSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return [];
  const models = parsed.data.data.map((m): ListedModel => {
    const supported = m.supported_parameters ?? null;
    const modalities = m.architecture?.input_modalities ?? null;
    return {
      id: normalizeModelId(m.id),
      contextWindow: m.context_length ?? null,
      supportsTools: supported === null ? null : supported.includes('tools'),
      supportsStructuredOutput: supported === null ? null : supported.includes('response_format'),
      vision: modalities === null ? null : modalities.includes('image'),
      promptPriceUsd: toNumber(m.pricing?.prompt),
      completionPriceUsd: toNumber(m.pricing?.completion),
    };
  });
  params.cache?.set(key, { at: nowMs(), models });
  return models;
}

/** Capacidades que a lista permite afirmar (campos `null` ficam de fora). */
export function listedModelCapabilities(model: ListedModel): Partial<ModelCapabilities> {
  return {
    ...(model.contextWindow === null ? {} : { contextWindow: model.contextWindow }),
    ...(model.supportsTools === null ? {} : { tools: model.supportsTools }),
    ...(model.supportsStructuredOutput === null ? {} : { structuredOutput: model.supportsStructuredOutput }),
    ...(model.vision === null ? {} : { vision: model.vision }),
  };
}
