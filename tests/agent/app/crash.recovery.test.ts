import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RecoverRunsUseCase } from '../../../src/app/agent/use-cases/recover.runs.use.case.ts';
import { RetryLastUseCase } from '../../../src/app/agent/use-cases/retry.last.use.case.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { makeConversation, makeNewMessage, makeRun } from '../store/support/agent.fixtures.ts';
import { LOCAL_MAIN, makeAgentApp } from './support/agent.app.harness.ts';

const NOW = new Date('2026-10-22T12:00:00.000Z');

describe('retomada depois que o processo morreu (SC-003)', () => {
  it('abrir a sessao marca a resposta como interrompida; "Tentar de novo" gera UMA resposta nova, sem duplicar a pergunta', async () => {
    // estado deixado por um processo que morreu no meio: pergunta, resposta em streaming com parcial e run "running"
    const store = new FakeAgentStore();
    await store.conversations.create(makeConversation('c1', 'u1'));
    await store.messages.append(makeNewMessage('q1', 'c1', 'u1', { role: 'user', parts: [{ type: 'text', text: 'quanto gastei em setembro?' }] }));
    await store.messages.append(makeNewMessage('a1', 'c1', 'u1', { role: 'assistant', status: 'streaming', runId: 'r1', parts: [{ type: 'text', text: 'Você gastou R$' }] }));
    await store.runs.create(makeRun('r1', 'c1', 'u1', { userMessageId: 'q1', assistantMessageId: 'a1', heartbeatAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() }));

    // processo novo, mesmo armazenamento
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'Não encontrei lançamentos em set/2026.' }, { type: 'finish', reason: 'stop' }] }]);
    const app = makeAgentApp({ llm, store });
    await app.configure([LOCAL_MAIN]);
    assert.equal((await app.deps.store.runs.get('u1', 'r1'))?.status, 'running');

    const recovered = await new RecoverRunsUseCase(store, app.settings, app.deps.clock).execute({ userId: 'u1' });
    assert.equal(recovered.recovered, 1);

    const interrupted = (await store.messages.list('u1', 'c1', { limit: 10 })).at(-1);
    assert.equal(interrupted?.status, 'interrupted');
    assert.deepEqual(interrupted?.parts, [{ type: 'text', text: 'Você gastou R$' }]);

    const retry = await new RetryLastUseCase(app.send).execute({ userId: 'u1', conversationId: 'c1', messageId: 'a1' });
    await app.runs.settled(retry.runId);
    const messages = await store.messages.list('u1', 'c1', { limit: 10 });
    assert.equal(messages.filter((m) => m.role === 'user').length, 1, 'exatamente 1 pergunta');
    assert.deepEqual(messages.filter((m) => m.role === 'assistant').map((m) => m.status), ['interrupted', 'complete'], '1 interrompida e 1 nova');
    assert.equal(llm.requests.length, 1);
    assert.equal((await store.runs.get('u1', 'r1'))?.status, 'interrupted');
    assert.equal((await store.runs.get('u1', retry.runId))?.status, 'done');
  });
});
