import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';
import { type ChatViewState } from '../../../src/app/agent/view/chat.view.state.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';

let seq = 0;
const ev = <T extends AgentEvent['type']>(body: Extract<AgentEvent, { type: T }> extends infer E ? Omit<E & object, 'conversationId' | 'runId' | 'seq'> : never): AgentEvent => ({ conversationId: 'c1', runId: 'r1', seq: (seq += 1), ...(body as object) }) as AgentEvent;

function started(): ChatViewState {
  seq = 0;
  return reduceChat(emptyChatState(), ev({ type: 'run_started', assistantMessageId: 'a1', userMessageId: 'u1' } as never));
}

describe('cartao do plano na conversa', () => {
  it('plan_updated acrescenta a parte uma unica vez e o texto fica antes do cartao', () => {
    let state = started();
    state = reduceChat(state, ev({ type: 'plan_updated', messageId: 'a1', planId: 'p1', status: 'pending' } as never));
    state = reduceChat(state, ev({ type: 'plan_updated', messageId: 'a1', planId: 'p1', status: 'pending' } as never));
    state = reduceChat(state, ev({ type: 'text_delta', messageId: 'a1', text: 'Montei o plano.' } as never));
    assert.deepEqual(state.messages[0]?.parts, [{ type: 'text', text: 'Montei o plano.' }, { type: 'plan', planId: 'p1' }]);
  });

  it('plano atras de aviso fica antes do aviso', () => {
    let state = started();
    state = reduceChat(state, ev({ type: 'notice', messageId: 'a1', notice: { type: 'notice', kind: 'no_tools', text: 'x' } } as never));
    state = reduceChat(state, ev({ type: 'plan_updated', messageId: 'a1', planId: 'p1', status: 'pending' } as never));
    assert.deepEqual(state.messages[0]?.parts.map((p) => p.type), ['plan', 'notice']);
  });
});
