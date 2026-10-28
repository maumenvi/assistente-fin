import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { RunCancelledError } from '../../../src/domain/agent/errors/run.cancelled.error.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { DEFAULT_RETRY_OPTIONS } from '../../../src/libs/llm/default.retry.options.ts';
import { withRetry } from '../../../src/libs/llm/with.retry.ts';

const OK: LlmEvent[] = [{ type: 'text_delta', text: 'ok' }, { type: 'finish', reason: 'stop' }];

function fakeDeps(): { sleeps: number[]; deps: { sleep: (ms: number) => Promise<void>; random: () => number } } {
  const sleeps: number[] = [];
  return {
    sleeps,
    deps: {
      sleep: (ms: number) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      random: () => 0.5,
    },
  };
}

/** Cada tentativa: lista de eventos e, no fim, um erro opcional. */
function scripted(attempts: { events: LlmEvent[]; error?: Error }[]): () => AsyncIterable<LlmEvent> {
  let index = 0;
  return () => {
    const attempt = attempts[Math.min(index, attempts.length - 1)] as { events: LlmEvent[]; error?: Error };
    index += 1;
    return (async function* () {
      for (const event of attempt.events) yield event;
      if (attempt.error) throw attempt.error;
    })();
  };
}

async function drain(iterable: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const event of iterable) out.push(event);
  return out;
}

describe('withRetry', () => {
  it('sucesso na segunda tentativa, esperando o atraso base (400 ms com jitter neutro)', async () => {
    const { sleeps, deps } = fakeDeps();
    const start = scripted([{ events: [], error: new LlmUnavailableError() }, { events: OK }]);
    assert.deepEqual(await drain(withRetry(start, undefined, DEFAULT_RETRY_OPTIONS, deps)), OK);
    assert.deepEqual(sleeps, [400]);
  });

  it('esgota as 2 retentativas (400 ms e 1,2 s) e sobe o erro', async () => {
    const { sleeps, deps } = fakeDeps();
    const start = scripted([{ events: [], error: new LlmUnavailableError('caiu') }]);
    await assert.rejects(drain(withRetry(start, undefined, DEFAULT_RETRY_OPTIONS, deps)), /caiu/);
    assert.deepEqual(sleeps, [400, 1200]);
  });

  it('erro nao retentavel sobe na hora', async () => {
    const { sleeps, deps } = fakeDeps();
    const start = scripted([{ events: [], error: new LlmAuthError() }]);
    await assert.rejects(drain(withRetry(start, undefined, DEFAULT_RETRY_OPTIONS, deps)), LlmAuthError);
    assert.deepEqual(sleeps, []);
  });

  it('erro depois de conteudo entregue NAO retenta (nao duplica texto)', async () => {
    const { sleeps, deps } = fakeDeps();
    const start = scripted([{ events: [{ type: 'text_delta', text: 'parcial' }], error: new LlmUnavailableError() }, { events: OK }]);
    const seen: LlmEvent[] = [];
    await assert.rejects(
      (async () => {
        for await (const event of withRetry(start, undefined, DEFAULT_RETRY_OPTIONS, deps)) seen.push(event);
      })(),
      LlmUnavailableError,
    );
    assert.deepEqual(seen, [{ type: 'text_delta', text: 'parcial' }]);
    assert.deepEqual(sleeps, []);
  });

  it('respeita Retry-After e limita a 5 s', async () => {
    const { sleeps, deps } = fakeDeps();
    const start = scripted([
      { events: [], error: new LlmRateLimitedError(2000) },
      { events: [], error: new LlmRateLimitedError(60_000) },
      { events: OK },
    ]);
    await drain(withRetry(start, undefined, DEFAULT_RETRY_OPTIONS, deps));
    assert.deepEqual(sleeps, [2000, 5000]);
  });

  it('jitter fica dentro de +-20%', async () => {
    for (const [random, expected] of [[0, 320], [0.999999, 480]] as const) {
      const sleeps: number[] = [];
      const deps = { sleep: (ms: number) => { sleeps.push(ms); return Promise.resolve(); }, random: () => random };
      const start = scripted([{ events: [], error: new LlmUnavailableError() }, { events: OK }]);
      await drain(withRetry(start, undefined, DEFAULT_RETRY_OPTIONS, deps));
      assert.ok(Math.abs((sleeps[0] as number) - expected) <= 1, `${sleeps[0]} vs ${expected}`);
    }
  });

  it('cancelar durante o atraso lanca RunCancelledError', async () => {
    const controller = new AbortController();
    const deps = {
      sleep: () => {
        controller.abort();
        return Promise.reject(new RunCancelledError());
      },
      random: () => 0.5,
    };
    const start = scripted([{ events: [], error: new LlmUnavailableError() }, { events: OK }]);
    await assert.rejects(drain(withRetry(start, controller.signal, DEFAULT_RETRY_OPTIONS, deps)), RunCancelledError);
  });

  it('ja abortado antes de comecar nem abre o stream', async () => {
    const controller = new AbortController();
    controller.abort();
    let opened = false;
    const start = () => {
      opened = true;
      return (async function* () {})();
    };
    await assert.rejects(drain(withRetry(start, controller.signal)), RunCancelledError);
    assert.equal(opened, false);
  });
});
