import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { RunCancelledError } from '../../../src/domain/agent/errors/run.cancelled.error.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { parseReplayFixture } from '../../../src/libs/llm/replay/parse.replay.fixture.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { type ReplayTurn } from '../../../src/libs/llm/replay/replay.turn.ts';

const REQUEST = { system: 's', messages: [] };
const HELLO: ReplayTurn = { events: [{ type: 'text_delta', text: 'ola' }, { type: 'finish', reason: 'stop' }] };

async function collect(iterable: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const e of iterable) out.push(e);
  return out;
}

describe('ReplayLlm', () => {
  it('reproduz a resposta gravada e guarda os pedidos', async () => {
    const llm = new ReplayLlm(CONSERVATIVE_CAPABILITIES, [HELLO]);
    assert.deepEqual(await collect(llm.stream(REQUEST)), HELLO.events);
    assert.equal(llm.requests.length, 1);
    assert.equal(llm.requests[0], REQUEST);
  });

  it('a i-esima chamada toca a i-esima resposta; a ultima se repete', async () => {
    const second: ReplayTurn = { events: [{ type: 'text_delta', text: 'dois' }, { type: 'finish', reason: 'stop' }] };
    const llm = new ReplayLlm(CONSERVATIVE_CAPABILITIES, [HELLO, second]);
    assert.equal(((await collect(llm.stream(REQUEST)))[0] as { text: string }).text, 'ola');
    assert.equal(((await collect(llm.stream(REQUEST)))[0] as { text: string }).text, 'dois');
    assert.equal(((await collect(llm.stream(REQUEST)))[0] as { text: string }).text, 'dois');
  });

  it('falha gravada vira o erro de dominio, com emittedContent inferido', async () => {
    const before = new ReplayLlm(CONSERVATIVE_CAPABILITIES, [{ events: [], error: { code: 'LLM_AUTH' } }]);
    await assert.rejects(collect(before.stream(REQUEST)), (e: unknown) => {
      assert.ok(e instanceof LlmAuthError);
      assert.equal(e.emittedContent, false);
      return true;
    });
    const after = new ReplayLlm(CONSERVATIVE_CAPABILITIES, [
      { events: [{ type: 'text_delta', text: 'parcial' }], error: { code: 'LLM_UNAVAILABLE', message: 'caiu' } },
    ]);
    await assert.rejects(collect(after.stream(REQUEST)), (e: unknown) => {
      assert.ok(e instanceof LlmUnavailableError);
      assert.equal(e.emittedContent, true);
      return true;
    });
    const limited = new ReplayLlm(CONSERVATIVE_CAPABILITIES, [{ events: [], error: { code: 'LLM_RATE_LIMITED', retryAfterMs: 900 } }]);
    await assert.rejects(collect(limited.stream(REQUEST)), (e: unknown) => e instanceof LlmRateLimitedError && e.retryAfterMs === 900);
  });

  it('cancelar no meio lanca RunCancelledError', async () => {
    const controller = new AbortController();
    const llm = new ReplayLlm(CONSERVATIVE_CAPABILITIES, [{ events: HELLO.events, delayMs: 5 }]);
    await assert.rejects(
      (async () => {
        for await (const _ of llm.stream(REQUEST, controller.signal)) controller.abort();
      })(),
      RunCancelledError,
    );
  });

  it('sem respostas gravadas e erro de configuracao', () => {
    assert.throws(() => new ReplayLlm(CONSERVATIVE_CAPABILITIES, []), /ao menos uma/);
  });
});

describe('parseReplayFixture', () => {
  it('le uma fixture valida', () => {
    const turns = parseReplayFixture({
      version: 1,
      turns: [{ events: [{ type: 'tool_call', id: 'c1', name: 'q', args: { a: 1 } }, { type: 'finish', reason: 'tool_calls' }], delayMs: 2 }],
    });
    assert.equal(turns.length, 1);
    assert.equal(turns[0]?.delayMs, 2);
    assert.equal(turns[0]?.events[0]?.type, 'tool_call');
  });

  it('recusa versao errada, evento desconhecido e lista vazia', () => {
    assert.throws(() => parseReplayFixture({ version: 2, turns: [] }), /fixture de replay invalida/);
    assert.throws(() => parseReplayFixture({ version: 1, turns: [{ events: [{ type: 'mistério' }] }] }), /invalida/);
    assert.throws(() => parseReplayFixture({ version: 1, turns: [] }), /invalida/);
  });
});
