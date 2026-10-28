import { z } from 'zod';
import { type KeyInfo } from '../../../domain/agent/connection/key.info.ts';
import { type FetchFn } from '../fetch.fn.ts';
import { mapHttpError } from '../openai-compat/map.http.error.ts';
import { mapNetworkError } from '../openai-compat/map.network.error.ts';

const schema = z.object({
  data: z.object({
    limit: z.number().nullish(),
    limit_remaining: z.number().nullish(),
    expires_at: z.string().nullish(),
  }),
});

export interface OpenRouterKeyInfoParams {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly fetchFn: FetchFn;
  readonly signal?: AbortSignal;
}

/**
 * `GET {baseUrl}/auth/key` do OpenRouter (spec 035, R3): limite, saldo restante e validade da chave. Resposta fora do
 * formato devolve tudo `null` (nao e erro); 401 etc. lancam o erro de dominio.
 */
export async function openRouterKeyInfo(params: OpenRouterKeyInfoParams): Promise<KeyInfo> {
  let response: Response;
  try {
    response = await params.fetchFn(`${params.baseUrl.replace(/\/+$/, '')}/auth/key`, {
      method: 'GET',
      headers: { authorization: `Bearer ${params.apiKey}` },
      ...(params.signal ? { signal: params.signal } : {}),
    });
  } catch (error) {
    throw mapNetworkError(error, false);
  }
  if (!response.ok) {
    throw mapHttpError({
      status: response.status,
      bodyText: await response.text().catch(() => ''),
      retryAfterHeader: response.headers.get('retry-after'),
      now: new Date(),
      emittedContent: false,
    });
  }
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return { limitUsd: null, remainingUsd: null, expiresAt: null };
  const { limit, limit_remaining: remaining, expires_at: expiresAt } = parsed.data.data;
  return { limitUsd: limit ?? null, remainingUsd: remaining ?? null, expiresAt: expiresAt ?? null };
}
