import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { readSseStream } from '../../sse/read.sse.stream.ts';
import { type FetchFn } from '../fetch.fn.ts';
import { mapStream } from './map.stream.ts';

export interface ProbeStreamParams {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly fetchFn: FetchFn;
  readonly signal?: AbortSignal;
}

/**
 * Sonda de formato do stream do teste de conexao (spec 037, FR-017): faz uma chamada em stream minima
 * (com a ferramenta ficticia `ping`) e le a resposta pelo MESMO `mapStream` do chat. So uma resposta em
 * formato ilegivel (`LlmProtocolError`) reprova; falha de rede, status HTTP ou resposta vazia sao
 * inconclusivas aqui (as outras etapas do teste ja as cobrem) e retornam normalmente.
 */
export async function probeStream(params: ProbeStreamParams): Promise<void> {
  let response: Response;
  try {
    response = await params.fetchFn(`${params.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...(params.apiKey ? { authorization: `Bearer ${params.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: params.model,
        stream: true,
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
  } catch {
    return;
  }
  if (!response.ok || response.body === null) return;
  try {
    for await (const _event of mapStream(readSseStream(response.body, params.signal))) {
      // so exercita o leitor; o conteudo nao e usado
    }
  } catch (error) {
    if (error instanceof LlmProtocolError) throw error;
  }
}
