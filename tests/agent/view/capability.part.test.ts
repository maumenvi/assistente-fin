import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { capabilityRequestParts } from '../../../src/app/agent/graph/nodes/capability.request.parts.ts';
import { initialAgentState } from '../../../src/app/agent/graph/initial.agent.state.ts';

let seq = 0;
const ev = (body: object): AgentEvent => ({ conversationId: 'c1', runId: 'r1', seq: (seq += 1), ...body }) as AgentEvent;

describe('cartao de pedido de capacidade na conversa', () => {
  it('capability_requested acrescenta a parte uma unica vez e o texto fica antes do cartao', () => {
    seq = 0;
    let state = reduceChat(emptyChatState(), ev({ type: 'run_started', assistantMessageId: 'a1', userMessageId: 'u1' }));
    state = reduceChat(state, ev({ type: 'capability_requested', messageId: 'a1', requestId: 'q1' }));
    state = reduceChat(state, ev({ type: 'capability_requested', messageId: 'a1', requestId: 'q1' }));
    state = reduceChat(state, ev({ type: 'text_delta', messageId: 'a1', text: 'Achei uma opcao.' }));
    const parts = state.messages.find((m) => m.id === 'a1')?.parts ?? [];
    assert.deepEqual(parts.map((p) => p.type), ['text', 'capability_request']);
  });
  it('estado inicial tem a lista vazia e as partes saem na ordem de criacao', () => {
    assert.deepEqual(initialAgentState('r').capabilityRequestIds, []);
    assert.deepEqual(capabilityRequestParts(['a', 'b']), [{ type: 'capability_request', requestId: 'a' }, { type: 'capability_request', requestId: 'b' }]);
  });
});
