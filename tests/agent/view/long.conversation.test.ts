import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GetConversationMessagesUseCase } from '../../../src/app/agent/use-cases/get.conversation.messages.use.case.ts';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { addUserMessage } from '../../../src/app/agent/view/add.user.message.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { makeConversation, makeNewMessage } from '../store/support/agent.fixtures.ts';

describe('conversa longa (SC-010)', () => {
  it('500 mensagens: a primeira pagina (50) carrega rapido e a paginacao nunca devolve duplicatas', async () => {
    const store = new FakeAgentStore();
    await store.conversations.create(makeConversation('c1', 'u1'));
    for (let i = 0; i < 500; i += 1) await store.messages.append(makeNewMessage(`m${i}`, 'c1', 'u1', { role: i % 2 === 0 ? 'user' : 'assistant' }));
    const useCase = new GetConversationMessagesUseCase(store);
    const startedAt = performance.now();
    const first = await useCase.execute({ userId: 'u1', conversationId: 'c1' });
    assert.ok(performance.now() - startedAt < 50, 'primeira pagina lenta');
    assert.equal(first.length, 50);

    const seen = new Set(first.map((m) => m.id));
    let before = first[0]?.seq ?? 0;
    let pages = 1;
    for (;;) {
      const page = await useCase.execute({ userId: 'u1', conversationId: 'c1', beforeSeq: before });
      if (page.length === 0) break;
      for (const m of page) {
        assert.ok(!seen.has(m.id), `duplicada: ${m.id}`);
        seen.add(m.id);
      }
      before = page[0]?.seq ?? 0;
      pages += 1;
    }
    assert.equal(seen.size, 500);
    assert.equal(pages, 10);
  });

  it('reduceChat aplica 1000 text_delta em menos de 50 ms', () => {
    let state = addUserMessage({ ...emptyChatState(), conversationId: 'c1' }, { id: 'u', text: 'oi' });
    const events: AgentEvent[] = [{ type: 'run_started', runId: 'r', conversationId: 'c1', seq: 0, userMessageId: 'u', assistantMessageId: 'a' }];
    for (let i = 1; i <= 1000; i += 1) events.push({ type: 'text_delta', runId: 'r', conversationId: 'c1', seq: i, messageId: 'a', text: 'palavra ' });
    const startedAt = performance.now();
    for (const event of events) state = reduceChat(state, event);
    assert.ok(performance.now() - startedAt < 50, `lento: ${performance.now() - startedAt} ms`);
    const text = state.messages.at(-1)?.parts[0];
    assert.equal(text?.type === 'text' && text.text.length, 'palavra '.length * 1000);
  });
});
