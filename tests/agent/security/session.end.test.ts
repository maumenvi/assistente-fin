import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CancelRunsOnSessionEndUseCase } from '../../../src/app/agent/use-cases/cancel.runs.on.session.end.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_MAIN, makeAgentApp } from '../app/support/agent.app.harness.ts';

const slow = { events: [{ type: 'text_delta' as const, text: 'Parte um ' }, { type: 'text_delta' as const, text: 'parte dois ' }, { type: 'text_delta' as const, text: 'fim' }, { type: 'finish' as const, reason: 'stop' as const }], delayMs: 150 };

describe('fim da sessao (T118)', () => {
  it('logout no meio de uma execucao: a run termina cancelled, nenhum evento mais sai e a rede para', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [slow]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const run = await app.send.execute({ userId: 'u1', text: 'quanto gastei em setembro?' });
    await new Promise((r) => setTimeout(r, 200));
    const eventsBefore = app.events.length;
    const result = await new CancelRunsOnSessionEndUseCase(app.runs).execute({ userId: 'u1' });
    assert.deepEqual(result, { cancelled: 1 });
    await app.runs.settled(run.runId);
    assert.equal((await app.store.runs.get('u1', run.runId))?.status, 'cancelled');
    // silenciada: nem o `run_finished` da execucao cancelada chega a UI da sessao seguinte
    assert.equal(app.events.length, eventsBefore);
    assert.ok(!app.events.some((e) => e.type === 'run_finished'));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(llm.requests.length, 1, 'nenhuma chamada de rede continua');
    assert.equal(app.events.length, eventsBefore);
  });

  it('a sessao seguinte (outro usuario) nao ve mensagens nem conversas do anterior', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [slow]) });
    await app.configure([LOCAL_MAIN]);
    const run = await app.send.execute({ userId: 'u1', text: 'quanto gastei em setembro?' });
    await new CancelRunsOnSessionEndUseCase(app.runs).execute({ userId: 'u1' });
    await app.runs.settled(run.runId);
    assert.deepEqual(await app.store.conversations.list('u2', { limit: 10 }), []);
    assert.deepEqual(await app.store.messages.list('u2', run.conversationId, { limit: 10 }), []);
  });

  it('so cancela as execucoes do usuario que saiu; sem execucao ativa e inofensivo; entrada invalida', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [slow]) });
    await app.configure([LOCAL_MAIN]);
    const useCase = new CancelRunsOnSessionEndUseCase(app.runs);
    assert.deepEqual(await useCase.execute({ userId: 'u1' }), { cancelled: 0 });
    const run = await app.send.execute({ userId: 'u1', text: 'quanto gastei?' });
    assert.deepEqual(await useCase.execute({ userId: 'u2' }), { cancelled: 0 });
    assert.equal(app.runs.hasConversation(run.conversationId), true);
    await app.runs.settled(run.runId);
    await assert.rejects(useCase.execute({}), InvalidInputError);
  });
});
