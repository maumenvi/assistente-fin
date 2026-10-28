import { z } from 'zod';
import { type FetchFn } from '../fetch.fn.ts';
import { mapHttpError } from './map.http.error.ts';
import { mapNetworkError } from './map.network.error.ts';

const usageSchema = z.object({ usage: z.object({ prompt_tokens: z.number().nullish() }).nullish() });

export interface ProbeContextParams {
  readonly baseUrl: string;
  readonly model: string;
  readonly fetchFn: FetchFn;
  readonly signal?: AbortSignal;
}

/** Texto de enchimento de ~9 mil tokens (so para servidor LOCAL: nunca enviado a nuvem). */
const FILLER = 'lorem ipsum dolor sit amet '.repeat(1500);

/**
 * Sonda de enchimento (spec 035, R3): manda ~9 mil tokens com `max_tokens: 1` e le `prompt_tokens`. Um servidor que
 * trunca silenciosamente a 4 096 devolve `prompt_tokens <= 4096`. Devolve `null` se o servidor nao informa o uso.
 * So deve ser chamada com servidor local; erros lancam o erro de dominio.
 */
export async function probeContext(params: ProbeContextParams): Promise<number | null> {
  let response: Response;
  try {
    response = await params.fetchFn(`${params.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: params.model, stream: false, temperature: 0, max_tokens: 1, messages: [{ role: 'user', content: `${FILLER}\nResponda apenas: ok` }] }),
      ...(params.signal ? { signal: params.signal } : {}),
    });
  } catch (error) {
    throw mapNetworkError(error, false);
  }
  if (!response.ok) {
    throw mapHttpError({ status: response.status, bodyText: await response.text().catch(() => ''), retryAfterHeader: response.headers.get('retry-after'), now: new Date(), emittedContent: false });
  }
  const parsed = usageSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? (parsed.data.usage?.prompt_tokens ?? null) : null;
}
