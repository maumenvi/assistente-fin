import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { LlmUnavailableError } from '../../../domain/agent/errors/llm.unavailable.error.ts';
import { type LlmEvent } from '../../../app/agent/ports/llm/llm.event.ts';
import { type LlmFinishReason } from '../../../app/agent/ports/llm/llm.finish.reason.ts';
import { type SseEvent } from '../../sse/sse.event.ts';
import { usdToMicro } from '../../../domain/agent/usd.to.micro.ts';
import { chunkSchema } from './chunk.schema.ts';
import { contentText } from './content.text.ts';
import { describeChunkIssue } from './describe.chunk.issue.ts';
import { mapStreamError } from './map.stream.error.ts';
import { ToolCallAccumulator } from './tool.call.accumulator.ts';

function mapFinishReason(reason: string): LlmFinishReason {
  if (reason === 'tool_calls' || reason === 'function_call') return 'tool_calls';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'content_filter';
  return 'stop';
}

/**
 * Transforma os eventos SSE de um `chat.completion` em eventos de dominio (spec 031,
 * contracts/openai-compat.wire.md). Texto e raciocinio saem na hora; chamadas de ferramenta,
 * estado do provedor, uso e `finish` saem no fim do stream (`[DONE]` ou fim do corpo), nessa
 * ordem. Lanca erro de dominio para chunk invalido, erro dentro do stream ou fim sem resposta.
 */
export async function* mapStream(source: AsyncIterable<SseEvent>): AsyncGenerator<LlmEvent, void, undefined> {
  const tools = new ToolCallAccumulator();
  let emitted = false;
  let finishReason: string | null = null;
  let done = false;
  let usage: LlmEvent | null = null;
  let reasoningDetails: unknown[] = [];
  for await (const sse of source) {
    if (sse.data === '[DONE]') {
      done = true;
      break;
    }
    let json: unknown;
    try {
      json = JSON.parse(sse.data);
    } catch {
      throw new LlmProtocolError('chunk do stream nao e JSON', emitted, 'chunk_invalido');
    }
    const parsed = chunkSchema.safeParse(json);
    if (!parsed.success) {
      throw new LlmProtocolError(`chunk do stream fora do formato esperado (campo ${describeChunkIssue(parsed.error)})`, emitted, 'chunk_invalido');
    }
    const chunk = parsed.data;
    if (chunk.error) throw mapStreamError(chunk.error, emitted);
    if (chunk.usage) {
      const cached = chunk.usage.prompt_tokens_details?.cached_tokens;
      usage = {
        type: 'usage',
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0,
        ...(cached === undefined || cached === null ? {} : { cachedTokens: cached }),
        ...(chunk.usage.cost === undefined || chunk.usage.cost === null
          ? {}
          : { costMicroUsd: usdToMicro(chunk.usage.cost) }),
      };
    }
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta;
      if (delta) {
        const text = contentText(delta.content);
        if (text !== '') {
          emitted = true;
          yield { type: 'text_delta', text };
        }
        const reasoning = delta.reasoning ?? delta.reasoning_content;
        if (reasoning) yield { type: 'reasoning_delta', text: reasoning };
        if (delta.reasoning_details) reasoningDetails = reasoningDetails.concat(delta.reasoning_details);
        if (delta.tool_calls) {
          emitted = true;
          tools.push(delta.tool_calls);
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }
  const noEnd = finishReason === null && !done;
  if (noEnd && !emitted) throw new LlmUnavailableError('o provedor encerrou o stream sem resposta', false);
  const calls = tools.finalize();
  // Fim sem sinal de termino e aceito quando a saida esta inteira (FR-016); chamada cortada no meio nao.
  if (noEnd && calls.some((call) => call.argsError !== undefined)) {
    throw new LlmProtocolError('o stream terminou no meio de uma chamada de ferramenta', true, 'fim_inesperado');
  }
  for (const call of calls) {
    const extra = call.extra === undefined ? {} : { extra: call.extra };
    yield call.argsError === undefined
      ? { type: 'tool_call', id: call.id, name: call.name, args: call.args, ...extra }
      : { type: 'tool_call', id: call.id, name: call.name, args: null, argsError: call.argsError, ...extra };
  }
  if (reasoningDetails.length > 0) {
    yield { type: 'provider_state', state: { reasoning_details: reasoningDetails } };
  }
  if (usage !== null) yield usage;
  // `stop` com chamadas presentes (Gemini) e aceito como veio: quem consome decide pelas chamadas.
  const reason: LlmFinishReason =
    finishReason !== null ? mapFinishReason(finishReason) : calls.length > 0 ? 'tool_calls' : 'stop';
  yield { type: 'finish', reason };
}
