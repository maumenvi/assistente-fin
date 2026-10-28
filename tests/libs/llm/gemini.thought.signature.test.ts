import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildRequestBody } from '../../../src/libs/llm/openai-compat/build.request.ts';
import { mapStream } from '../../../src/libs/llm/openai-compat/map.stream.ts';
import { collectStream } from '../../../src/libs/llm/collect.stream.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';

/** Capturas REAIS (sanitizadas) do `gemini-4-argon` no endpoint compativel com OpenAI, stream ligado. */
const fixture = (name: string): string => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
const sse = (raw: string) => raw.split('\n\n').filter((b) => b.trim() !== '').map((b) => ({ data: b.replace(/^data: /, '') }));
async function* source(raw: string) {
  for (const event of sse(raw)) yield event as never;
}
async function events(raw: string): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const e of mapStream(source(raw))) out.push(e);
  return out;
}

describe('gemini-4-argon: formato real do stream', () => {
  it('resposta de texto: chunk final so com extra_content (assinatura) e finish stop => texto "ok" e fim', async () => {
    assert.deepEqual(await events(fixture('gemini-4-argon.text.sse')), [{ type: 'text_delta', text: 'ok' }, { type: 'finish', reason: 'stop' }]);
  });

  it('chamada de ferramenta sem `index`, com `extra_content.google.thought_signature` e finish "stop": a chamada sai com o extra', async () => {
    const out = await events(fixture('gemini-4-argon.tool-call.sse'));
    const call = out.find((e) => e.type === 'tool_call');
    assert.ok(call && call.type === 'tool_call');
    assert.equal(call.name, 'ping');
    assert.deepEqual(call.args, { echo: 'ok' });
    assert.deepEqual(call.extra, { google: { thought_signature: 'SIG-FIXTURE-0001' } });
    assert.deepEqual(out.at(-1), { type: 'finish', reason: 'stop' });
  });

  it('a assinatura volta no turno seguinte: a chamada do assistente reenviada leva `extra_content` (sem ela o Google responde 400)', async () => {
    const turn = await collectStream((async function* () { yield* await events(fixture('gemini-4-argon.tool-call.sse')); })());
    const body = buildRequestBody({
      model: 'gemini-4-argon',
      origin: 'google',
      includeUsage: false,
      capabilities: CONSERVATIVE_CAPABILITIES,
      request: { system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'chame' }] }, { role: 'assistant', content: [], toolCalls: turn.toolCalls }, { role: 'tool', toolCallId: turn.toolCalls[0]?.id ?? '', content: 'ok' }] } as never,
    }) as { messages: { tool_calls?: { extra_content?: unknown }[] }[] };
    const assistant = body.messages.find((m) => m.tool_calls !== undefined);
    assert.deepEqual(assistant?.tool_calls?.[0]?.extra_content, { google: { thought_signature: 'SIG-FIXTURE-0001' } });
  });
});
