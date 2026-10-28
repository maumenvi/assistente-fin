import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmProtocolError } from '../../../src/domain/agent/errors/llm.protocol.error.ts';
import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { collectStream } from '../../../src/libs/llm/collect.stream.ts';

async function* events(list: LlmEvent[]): AsyncGenerator<LlmEvent> {
  for (const event of list) yield event;
}

describe('collectStream', () => {
  it('concatena texto, junta chamadas, guarda uso e fim', async () => {
    const result = await collectStream(
      events([
        { type: 'text_delta', text: 'Ola, ' },
        { type: 'reasoning_delta', text: 'pensando' },
        { type: 'text_delta', text: 'mundo' },
        { type: 'tool_call', id: 'c1', name: 'a', args: { x: 1 } },
        { type: 'tool_call', id: 'c2', name: 'b', args: { y: 2 } },
        { type: 'usage', inputTokens: 10, outputTokens: 4, costMicroUsd: 300 },
        { type: 'finish', reason: 'tool_calls' },
      ]),
    );
    assert.equal(result.text, 'Ola, mundo');
    assert.deepEqual(result.toolCalls.map((c) => c.id), ['c1', 'c2']);
    assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 4, costMicroUsd: 300 });
    assert.equal(result.finish, 'tool_calls');
    assert.equal('providerState' in result, false);
  });

  it('chamada com argumentos invalidos vira args null + argsError', async () => {
    const result = await collectStream(
      events([
        { type: 'tool_call', id: 'c1', name: 'a', args: null, argsError: 'json invalido' },
        { type: 'finish', reason: 'tool_calls' },
      ]),
    );
    assert.deepEqual(result.toolCalls, [{ id: 'c1', name: 'a', args: null, argsError: 'json invalido' }]);
  });

  it('preserva o estado do provedor', async () => {
    const result = await collectStream(
      events([{ type: 'provider_state', state: { r: 1 } }, { type: 'finish', reason: 'stop' }]),
    );
    assert.deepEqual(result.providerState, { r: 1 });
  });

  it('usage ausente e valido (modelo local)', async () => {
    const result = await collectStream(events([{ type: 'text_delta', text: 'x' }, { type: 'finish', reason: 'stop' }]));
    assert.equal(result.usage, null);
  });

  it('stream sem finish e erro de protocolo, indicando se ja saiu conteudo', async () => {
    await assert.rejects(collectStream(events([{ type: 'text_delta', text: 'x' }])), (e: unknown) => {
      assert.ok(e instanceof LlmProtocolError);
      assert.equal(e.emittedContent, true);
      return true;
    });
    await assert.rejects(collectStream(events([])), (e: unknown) => {
      assert.ok(e instanceof LlmProtocolError);
      assert.equal(e.emittedContent, false);
      return true;
    });
  });
});
