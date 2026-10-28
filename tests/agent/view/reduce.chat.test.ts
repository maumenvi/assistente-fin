import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { activityLabel } from '../../../src/app/agent/view/activity.label.ts';
import { addUserMessage } from '../../../src/app/agent/view/add.user.message.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { loadChatMessages } from '../../../src/app/agent/view/load.chat.messages.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';
import { agentGraph } from '../../../src/app/agent/graph/agent.graph.ts';
import { type ChatViewState } from '../../../src/app/agent/view/chat.view.state.ts';

const base = { runId: 'r1', conversationId: 'c1' };
const ev = (seq: number, body: Record<string, unknown>): AgentEvent => ({ ...base, seq, ...body }) as AgentEvent;
const started = ev(1, { type: 'run_started', userMessageId: 'u', assistantMessageId: 'a' });
const summary = { tool: 'query_transactions', label: 'lançamentos de set/2026', filters: {}, itemCount: 3, truncated: false };

function play(events: AgentEvent[], from: ChatViewState = addUserMessage({ ...emptyChatState(), conversationId: 'c1' }, { id: 'u', text: 'oi' })): ChatViewState {
  return events.reduce(reduceChat, from);
}

describe('reduceChat', () => {
  it('run_started cria a mensagem do assistente em streaming e a execucao ativa', () => {
    const state = play([started]);
    assert.equal(state.messages.at(-1)?.status, 'streaming');
    assert.equal(state.activeRun?.stoppable, true);
    assert.equal(state.activeRun?.label, 'Pensando…');
  });

  it('text_delta concatena; query_card entra antes do texto; notice depois', () => {
    const state = play([
      started,
      ev(2, { type: 'text_delta', messageId: 'a', text: 'Você ' }),
      ev(3, { type: 'query_card', messageId: 'a', summary }),
      ev(4, { type: 'text_delta', messageId: 'a', text: 'gastou.' }),
      ev(5, { type: 'notice', messageId: 'a', notice: { type: 'notice', kind: 'no_tools', text: 'x' } }),
      ev(6, { type: 'notice', messageId: 'a', notice: { type: 'notice', kind: 'no_tools', text: 'x' } }),
    ]);
    assert.deepEqual(state.messages.at(-1)?.parts.map((p) => p.type), ['query', 'text', 'notice']);
    assert.equal((state.messages.at(-1)?.parts[1] as { text: string }).text, 'Você gastou.');
  });

  it('eventos fora de ordem ou repetidos sao ignorados (idempotencia)', () => {
    const delta = ev(3, { type: 'text_delta', messageId: 'a', text: 'B' });
    const once = play([started, ev(2, { type: 'text_delta', messageId: 'a', text: 'A' }), delta]);
    const twice = play([started, ev(2, { type: 'text_delta', messageId: 'a', text: 'A' }), delta, delta, ev(2, { type: 'text_delta', messageId: 'a', text: 'A' })]);
    assert.deepEqual(twice, once);
    assert.equal((once.messages.at(-1)?.parts[0] as { text: string }).text, 'AB');
  });

  it('evento de outra conversa e ignorado; nova execucao reinicia o contador', () => {
    const other = { ...ev(2, { type: 'text_delta', messageId: 'a', text: 'X' }), conversationId: 'outra' } as AgentEvent;
    assert.equal(play([started, other]).messages.at(-1)?.parts.length, 0);
    const second = { ...started, runId: 'r2', seq: 1, assistantMessageId: 'a2' } as AgentEvent;
    const state = play([started, ev(2, { type: 'run_finished', status: 'done' }), second]);
    assert.equal(state.activeRun?.runId, 'r2');
  });

  it('message_replaced troca as partes', () => {
    const state = play([started, ev(2, { type: 'text_delta', messageId: 'a', text: 'R$ 999,00' }), ev(3, { type: 'message_replaced', messageId: 'a', parts: [{ type: 'text', text: '(valor não confirmado)' }] })]);
    assert.deepEqual(state.messages.at(-1)?.parts, [{ type: 'text', text: '(valor não confirmado)' }]);
  });

  it('node_started atualiza o rotulo da etapa', () => {
    const state = play([started, ev(2, { type: 'node_started', node: 'tools' })]);
    assert.equal(state.activeRun?.label, 'Consultando seus dados…');
  });

  it('run_finished: done zera a execucao e completa; falha de provedor mostra faixa e permite tentar de novo', () => {
    const done = play([started, ev(2, { type: 'run_finished', status: 'done' })]);
    assert.equal(done.activeRun, null);
    assert.equal(done.messages.at(-1)?.status, 'complete');
    assert.equal(done.canRetryLast, false);
    const failed = play([started, ev(2, { type: 'run_finished', status: 'failed', error: { code: 'LLM_UNAVAILABLE', message: 'x' } })]);
    assert.equal(failed.messages.at(-1)?.status, 'error');
    assert.equal(failed.messages.at(-1)?.errorCode, 'LLM_UNAVAILABLE');
    assert.equal(failed.banner?.kind, 'provider_down');
    assert.equal(failed.canRetryLast, true);
    const cancelled = play([started, ev(2, { type: 'run_finished', status: 'cancelled' })]);
    assert.equal(cancelled.messages.at(-1)?.status, 'interrupted');
    assert.equal(cancelled.banner, null);
  });

  it('loadChatMessages marca a ultima resposta incompleta como passivel de nova tentativa', () => {
    const msg = (id: string, role: 'user' | 'assistant', status: 'complete' | 'interrupted') => ({ id, conversationId: 'c1', userId: 'u1', seq: 1, role, parts: [], status, runId: null, errorCode: null, createdAt: '' });
    const state = loadChatMessages(emptyChatState(), 'c1', [msg('u', 'user', 'complete'), msg('a', 'assistant', 'interrupted')]);
    assert.equal(state.canRetryLast, true);
    assert.equal(state.conversationId, 'c1');
  });

  it('todo no do grafo tem texto de atividade proprio', () => {
    for (const node of Object.keys(agentGraph.nodes)) {
      assert.match(activityLabel(node), /…$/, node);
      if (node !== 'react') assert.notEqual(activityLabel(node), 'Pensando…', node);
    }
  });

  it('pedidos de pasta e de edicao entram na lista, sem duplicar, e saem quando decididos ou ao fim da execucao (spec 040)', () => {
    const folder = ev(2, { type: 'folder_permission_requested', requestId: 'q1', path: '/home/ana/Docs', access: 'read' });
    const edit = ev(3, { type: 'file_edit_confirmation_requested', requestId: 'q2', path: '/home/ana/Docs/a.txt', preview: { before: 'a', after: 'b', truncated: false } });
    let state = play([started, folder, edit]);
    assert.deepEqual(state.fileRequests.map((r) => [r.kind, r.requestId]), [['folder', 'q1'], ['edit', 'q2']]);
    state = reduceChat(state, ev(4, { type: 'file_request_resolved', requestId: 'q1', outcome: 'allowed' }));
    assert.deepEqual(state.fileRequests.map((r) => r.requestId), ['q2']);
    state = reduceChat(state, ev(5, { type: 'run_finished', status: 'cancelled' }));
    assert.deepEqual(state.fileRequests, []);
  });
});
