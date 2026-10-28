import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONTINUE_TURN_TEXT, ensureUserTurnLast } from '../../../src/app/agent/llm/ensure.user.turn.last.ts';
import { withUserTurnLast } from '../../../src/app/agent/llm/with.user.turn.last.ts';
import { type LlmMessage } from '../../../src/app/agent/ports/llm/llm.message.ts';
import { type LlmPort } from '../../../src/app/agent/ports/llm/llm.port.ts';
import { type LlmRequest } from '../../../src/app/agent/ports/llm/llm.request.ts';

const user: LlmMessage = { role: 'user', content: [{ type: 'text', text: 'oi' }] };
const assistant: LlmMessage = { role: 'assistant', content: [{ type: 'text', text: 'resposta pela metade' }] };

describe('ensureUserTurnLast (spec 040, R4)', () => {
  it('acrescenta turno do usuario quando termina em assistant', () => {
    const out = ensureUserTurnLast([user, assistant]);
    assert.equal(out.length, 3);
    assert.deepEqual(out.at(-1), { role: 'user', content: [{ type: 'text', text: CONTINUE_TURN_TEXT }] });
  });

  it('nao altera historico que termina em user, tool ou assistant com chamadas', () => {
    const tool: LlmMessage = { role: 'tool', toolCallId: 'c1', content: '{}' };
    const calling: LlmMessage = { role: 'assistant', content: [], toolCalls: [{ id: 'c1', name: 'x', arguments: {} } as never] };
    for (const history of [[user], [user, tool], [user, calling]]) {
      assert.equal(ensureUserTurnLast(history), history);
    }
  });

  it('historico vazio fica como esta', () => {
    assert.deepEqual(ensureUserTurnLast([]), []);
  });

  it('o decorador do porto envia ao modelo um pedido que termina em user', async () => {
    let seen: LlmRequest | undefined;
    const inner: LlmPort = {
      capabilities: {} as never,
      stream(request) {
        seen = request;
        return (async function* () {})();
      },
    };
    const port = withUserTurnLast(inner);
    for await (const _ of port.stream({ system: 's', messages: [user, assistant] })) void _;
    assert.equal(seen?.messages.at(-1)?.role, 'user');
  });
});
