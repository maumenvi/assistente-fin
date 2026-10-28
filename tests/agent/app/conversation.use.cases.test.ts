import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ActiveRuns } from '../../../src/app/agent/runs/active.runs.ts';
import { DeleteAllConversationsUseCase } from '../../../src/app/agent/use-cases/delete.all.conversations.use.case.ts';
import { DeleteConversationUseCase } from '../../../src/app/agent/use-cases/delete.conversation.use.case.ts';
import { GetConversationMessagesUseCase } from '../../../src/app/agent/use-cases/get.conversation.messages.use.case.ts';
import { ListConversationsUseCase } from '../../../src/app/agent/use-cases/list.conversations.use.case.ts';
import { NewConversationUseCase } from '../../../src/app/agent/use-cases/new.conversation.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { at, makeConversation, makeNewMessage, makeRun, makeStep } from '../store/support/agent.fixtures.ts';

async function setup() {
  const store = new FakeAgentStore();
  const runs = new ActiveRuns();
  const clock = new MutableClock(new Date('2026-10-22T13:00:00Z'));
  return { store, runs, list: new ListConversationsUseCase(store), messages: new GetConversationMessagesUseCase(store), create: new NewConversationUseCase(store, new SequentialIdGenerator('c'), clock), del: new DeleteConversationUseCase(store, runs), delAll: new DeleteAllConversationsUseCase(store, runs) };
}

describe('casos de uso de conversa', () => {
  it('nova conversa fica na lista; listagem isolada por usuario, mais recente primeiro', async () => {
    const t = await setup();
    const created = await t.create.execute({ userId: 'u1' });
    assert.equal(created.title, 'Nova conversa');
    await t.store.conversations.create(makeConversation('velha', 'u1', { lastMessageAt: at(0) }));
    await t.store.conversations.create(makeConversation('outra', 'u2'));
    const mine = await t.list.execute({ userId: 'u1' });
    assert.deepEqual(mine.map((c) => c.id), [created.id, 'velha']);
    assert.deepEqual((await t.list.execute({ userId: 'u2' })).map((c) => c.id), ['outra']);
    await assert.rejects(t.list.execute({ userId: '' }), InvalidInputError);
    await assert.rejects(t.list.execute({ userId: 'u1', limit: 51 }), InvalidInputError);
  });

  it('mensagens: 50 por pagina por beforeSeq, em ordem cronologica; outro usuario ve vazio', async () => {
    const t = await setup();
    await t.store.conversations.create(makeConversation('c1', 'u1'));
    for (let i = 0; i < 120; i += 1) await t.store.messages.append(makeNewMessage(`m${i}`, 'c1', 'u1', { role: i % 2 === 0 ? 'user' : 'assistant' }));
    const page1 = await t.messages.execute({ userId: 'u1', conversationId: 'c1' });
    assert.equal(page1.length, 50);
    assert.equal(page1.at(-1)?.id, 'm119');
    assert.equal(page1[0]?.id, 'm70');
    const all = await t.store.messages.list('u1', 'c1', { limit: 200 });
    const firstSeq = all.find((m) => m.id === 'm70')?.seq as number;
    const page2 = await t.messages.execute({ userId: 'u1', conversationId: 'c1', beforeSeq: firstSeq });
    assert.equal(page2.length, 50);
    assert.equal(page2.at(-1)?.id, 'm69');
    assert.deepEqual(await t.messages.execute({ userId: 'u2', conversationId: 'c1' }), []);
  });

  it('apagar remove mensagens, execucoes e passos; para a execucao ativa; outro usuario nao apaga', async () => {
    const t = await setup();
    await t.store.conversations.create(makeConversation('c1', 'u1'));
    await t.store.messages.append(makeNewMessage('m1', 'c1', 'u1'));
    await t.store.runs.create(makeRun('r1', 'c1', 'u1'));
    await t.store.steps.appendMany('u1', [makeStep('r1', 1)]);
    const controller = new AbortController();
    t.runs.register({ runId: 'r1', conversationId: 'c1', userId: 'u1', controller, settled: Promise.resolve() });
    await t.del.execute({ userId: 'u2', conversationId: 'c1' });
    assert.ok(await t.store.conversations.get('u1', 'c1'));
    await t.del.execute({ userId: 'u1', conversationId: 'c1' });
    assert.equal(controller.signal.aborted, true);
    assert.equal(await t.store.conversations.get('u1', 'c1'), null);
    assert.equal(await t.store.runs.get('u1', 'r1'), null);
    assert.deepEqual(await t.store.messages.list('u1', 'c1', { limit: 10 }), []);
    assert.deepEqual(await t.store.steps.list('u1', 'r1'), []);
  });

  it('apagar tudo remove so as do usuario', async () => {
    const t = await setup();
    await t.store.conversations.create(makeConversation('a', 'u1'));
    await t.store.conversations.create(makeConversation('b', 'u2'));
    await t.delAll.execute({ userId: 'u1' });
    assert.deepEqual(await t.store.conversations.list('u1', { limit: 10 }), []);
    assert.equal((await t.store.conversations.list('u2', { limit: 10 })).length, 1);
  });
});
