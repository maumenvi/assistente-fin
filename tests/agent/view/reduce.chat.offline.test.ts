import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeAgentError } from '../../../src/app/agent/errors/describe.agent.error.ts';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { addUserMessage } from '../../../src/app/agent/view/add.user.message.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';
import { reduceChatAction } from '../../../src/app/agent/view/reduce.chat.action.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';

const base = { runId: 'r1', conversationId: 'c1' };
const ev = (seq: number, body: Record<string, unknown>): AgentEvent => ({ ...base, seq, ...body }) as AgentEvent;

describe('offline no chat (T120)', () => {
  it('falha de conexao tem codigo OFFLINE e mensagem propria; timeout continua LLM_UNAVAILABLE', () => {
    assert.equal(new LlmUnavailableError('x', false, true).code, 'OFFLINE');
    assert.equal(new LlmUnavailableError('x').code, 'LLM_UNAVAILABLE');
    assert.match(describeAgentError('OFFLINE'), /Sem conexão/);
  });

  it('run_finished com OFFLINE mostra a faixa offline; o proximo envio (run_started) limpa', () => {
    let state = addUserMessage({ ...emptyChatState(), conversationId: 'c1' }, { id: 'u', text: 'oi' });
    state = [ev(1, { type: 'run_started', userMessageId: 'u', assistantMessageId: 'a' }), ev(2, { type: 'run_finished', status: 'failed', error: { code: 'OFFLINE', message: 'x' } })].reduce(reduceChat, state);
    assert.equal(state.banner?.kind, 'offline');
    assert.equal(state.messages.at(-1)?.status, 'error');
    assert.equal(state.canRetryLast, true);
    state = reduceChat(state, { ...base, runId: 'r2', seq: 1, type: 'run_started', userMessageId: 'u2', assistantMessageId: 'a2' } as AgentEvent);
    assert.equal(state.banner, null);
  });

  it('envio que falha por conexao tambem mostra a faixa offline, sem perder a pergunta no rascunho (acao da tela)', () => {
    const state = reduceChatAction(reduceChatAction(emptyChatState(), { kind: 'user_sent', id: 't', text: 'oi' }), { kind: 'send_failed', id: 't', code: 'OFFLINE' });
    assert.equal(state.banner?.kind, 'offline');
    assert.equal(state.messages.length, 0);
  });
});
