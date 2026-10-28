import { type FetchFn } from '../fetch.fn.ts';
import { completionSchema } from './completion.schema.ts';
import { mapHttpError } from './map.http.error.ts';
import { mapNetworkError } from './map.network.error.ts';

export interface ProbeToolSupportParams {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly fetchFn: FetchFn;
  readonly nowMs?: () => number;
  readonly signal?: AbortSignal;
}

/** Resultado da sonda. */
export interface ProbeToolSupportResult {
  readonly supportsTools: boolean;
  readonly latencyMs: number;
}

/**
 * Sonda de *tool calling* do teste de conexao (spec 031, D6): chamada NAO-streaming minima com a
 * ferramenta ficticia `ping(echo)`. Sucesso = o modelo chamou `ping` com `echo` textual. Custa
 * algumas dezenas de tokens. Erros de rede/autenticacao lancam o erro de dominio.
 */
export async function probeToolSupport(params: ProbeToolSupportParams): Promise<ProbeToolSupportResult> {
  const nowMs = params.nowMs ?? Date.now;
  const startedAt = nowMs();
  let response: Response;
  try {
    response = await params.fetchFn(`${params.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(params.apiKey ? { authorization: `Bearer ${params.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: params.model,
        stream: false,
        temperature: 0,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Chame a ferramenta ping com echo igual a "ok".' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'ping',
              description: 'Devolve o texto recebido.',
              parameters: { type: 'object', properties: { echo: { type: 'string' } }, required: ['echo'] },
            },
          },
        ],
        tool_choice: 'auto',
      }),
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
      now: new Date(nowMs()),
      emittedContent: false,
    });
  }
  const latencyMs = nowMs() - startedAt;
  const parsed = completionSchema.safeParse(await response.json().catch(() => null));
  const call = parsed.success ? parsed.data.choices?.[0]?.message?.tool_calls?.[0]?.function : undefined;
  if (!call || call.name !== 'ping') return { supportsTools: false, latencyMs };
  try {
    const args: unknown = JSON.parse(call.arguments ?? '{}');
    const echo = typeof args === 'object' && args !== null ? (args as { echo?: unknown }).echo : undefined;
    return { supportsTools: typeof echo === 'string', latencyMs };
  } catch {
    return { supportsTools: false, latencyMs };
  }
}
