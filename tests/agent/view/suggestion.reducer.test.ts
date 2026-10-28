import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { addUserMessage } from '../../../src/app/agent/view/add.user.message.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';

const ev = (runId: string, seq: number, body: Record<string, unknown>): AgentEvent => ({ runId, conversationId: 'c1', seq, ...body }) as AgentEvent;

describe('reducer da sugestao de preferencia', () => {
  const start = addUserMessage({ ...emptyChatState(), conversationId: 'c1' }, { id: 'u', text: 'oi' });
  const finished = [
    ev('r1', 1, { type: 'run_started', userMessageId: 'u', assistantMessageId: 'a' }),
    ev('r1', 2, { type: 'text_delta', messageId: 'a', text: 'Oi!' }),
    ev('r1', 3, { type: 'run_finished', status: 'done', consumed: {}, error: null }),
  ].reduce(reduceChat, start);

  it('o evento chega depois do fim da execucao (runId proprio) e anexa a sugestao aberta', () => {
    const state = reduceChat(finished, ev('r1:learn', 1, { type: 'preference_suggested', messageId: 'a', preferenceId: 'p1', text: 'Responder de forma curta.' }));
    assert.deepEqual(state.messages.at(-1)?.parts.at(-1), { type: 'suggestion', preferenceId: 'p1', text: 'Responder de forma curta.', state: 'open' });
    assert.equal(state.messages.at(-1)?.status, 'complete');
  });

  it('evento repetido nao duplica a sugestao; mensagem desconhecida e ignorada', () => {
    const body = { type: 'preference_suggested', messageId: 'a', preferenceId: 'p1', text: 'Texto.' };
    const once = reduceChat(finished, ev('r1:learn', 1, body));
    assert.equal(reduceChat(once, ev('r1:learn', 1, body)).messages.at(-1)?.parts.filter((p) => p.type === 'suggestion').length, 1);
    assert.equal(reduceChat(finished, ev('r2:learn', 1, { ...body, messageId: 'zzz' })).messages.length, finished.messages.length);
  });
});
