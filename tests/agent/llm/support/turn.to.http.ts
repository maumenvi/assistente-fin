import { type ServerResponse } from 'node:http';
import { type LlmEvent } from '../../../../src/app/agent/ports/llm/llm.event.ts';
import { type ReplayTurn } from '../../../../src/libs/llm/replay/replay.turn.ts';
import { delay, sendChunk, sendDone, sendHttpError, startSse } from './local.llm.server.ts';

const STATUS_BY_CODE: Record<string, number> = {
  LLM_AUTH: 401,
  LLM_QUOTA: 402,
  LLM_MODEL_NOT_FOUND: 404,
  LLM_RATE_LIMITED: 429,
  LLM_UNAVAILABLE: 503,
  LLM_PROTOCOL: 400,
};

function splitIn(text: string, parts: number): string[] {
  const size = Math.max(1, Math.ceil(text.length / parts));
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length > 0 ? out : [''];
}

/** Escreve em fatias de 5 bytes, para exercitar caracteres UTF-8 e eventos partidos entre pacotes. */
async function writeSliced(res: ServerResponse, text: string): Promise<void> {
  const bytes = Buffer.from(text, 'utf8');
  for (let i = 0; i < bytes.length; i += 5) {
    res.write(bytes.subarray(i, i + 5));
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function writeChunk(res: ServerResponse, chunk: unknown): Promise<void> {
  await writeSliced(res, `data: ${JSON.stringify(chunk)}\n\n`);
}

/**
 * Reproduz uma resposta gravada (`ReplayTurn`) como um provedor OpenAI-compativel faria: falha
 * antes de conteudo vira erro HTTP; falha depois vira chunk de erro no stream; ferramentas saem
 * com argumentos fragmentados em 7 partes. Permite rodar a mesma suite de contrato no adaptador.
 */
export async function playTurnOverHttp(turn: ReplayTurn, res: ServerResponse): Promise<void> {
  const hasContent = turn.events.some((e) => e.type === 'text_delta' || e.type === 'tool_call');
  if (turn.error && !hasContent) {
    const extra: Record<string, string> = {};
    if (turn.error.retryAfterMs !== undefined) extra['retry-after'] = String(turn.error.retryAfterMs / 1000);
    sendHttpError(res, STATUS_BY_CODE[turn.error.code] ?? 503, turn.error.message ?? 'erro', extra);
    return;
  }
  startSse(res);
  let toolIndex = 0;
  for (const event of turn.events as readonly LlmEvent[]) {
    if (turn.delayMs) await delay(turn.delayMs);
    if (res.destroyed) return;
    switch (event.type) {
      case 'text_delta':
        await writeChunk(res, { choices: [{ delta: { content: event.text } }] });
        break;
      case 'reasoning_delta':
        await writeChunk(res, { choices: [{ delta: { reasoning: event.text } }] });
        break;
      case 'tool_call': {
        const argsText = event.argsError === undefined ? JSON.stringify(event.args ?? {}) : '{"quebrado": ???';
        const index = toolIndex;
        toolIndex += 1;
        const [first, ...rest] = splitIn(argsText, 7);
        await writeChunk(res, {
          choices: [{ delta: { tool_calls: [{ index, id: event.id, type: 'function', function: { name: event.name, arguments: first ?? '' } }] } }],
        });
        for (const part of rest) {
          await writeChunk(res, { choices: [{ delta: { tool_calls: [{ index, function: { arguments: part } }] } }] });
        }
        break;
      }
      case 'provider_state':
        await writeChunk(res, { choices: [{ delta: { reasoning_details: (event.state as { reasoning_details: unknown[] }).reasoning_details } }] });
        break;
      case 'usage':
        await writeChunk(res, {
          choices: [],
          usage: {
            prompt_tokens: event.inputTokens,
            completion_tokens: event.outputTokens,
            ...(event.cachedTokens === undefined ? {} : { prompt_tokens_details: { cached_tokens: event.cachedTokens } }),
            ...(event.costMicroUsd === undefined ? {} : { cost: event.costMicroUsd / 1_000_000 }),
          },
        });
        break;
      case 'finish':
        await writeChunk(res, { choices: [{ delta: {}, finish_reason: event.reason }] });
        break;
    }
  }
  if (turn.error) {
    await writeChunk(res, { error: { code: STATUS_BY_CODE[turn.error.code] ?? 503, message: turn.error.message ?? 'erro' } });
    res.end();
    return;
  }
  sendDone(res);
}
