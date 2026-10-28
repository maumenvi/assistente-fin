import { z } from 'zod';
import { type FetchFn } from '../fetch.fn.ts';

const schema = z.object({ models: z.array(z.object({ name: z.string().nullish(), model: z.string().nullish(), context_length: z.number().nullish() })) });

export interface OllamaProcessInfoParams {
  /** Endereco compativel (`http://localhost:11434/v1`); a API nativa fica na raiz (`/api/ps`). */
  readonly baseUrl: string;
  readonly model: string;
  readonly fetchFn: FetchFn;
  readonly signal?: AbortSignal;
}

/**
 * `GET /api/ps` do Ollama (spec 035, R3): a janela de contexto com que o modelo esta CARREGADO agora. `null` quando o
 * modelo nao esta carregado, a rota nao existe ou a resposta nao traz o valor.
 */
export async function ollamaContextLength(params: OllamaProcessInfoParams): Promise<number | null> {
  const root = params.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
  try {
    const response = await params.fetchFn(`${root}/api/ps`, { method: 'GET', ...(params.signal ? { signal: params.signal } : {}) });
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return null;
    const loaded = parsed.data.models.find((m) => m.name === params.model || m.model === params.model);
    return loaded?.context_length ?? null;
  } catch {
    return null;
  }
}
