import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StopRunUseCase } from '../../../src/app/agent/use-cases/stop.run.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_MAIN, makeAgentApp } from './support/agent.app.harness.ts';

const slow = (delayMs: number) => ({ events: [{ type: 'text_delta' as const, text: 'Parcial ' }, { type: 'text_delta' as const, text: 'segunda parte ' }, { type: 'text_delta' as const, text: 'fim' }, { type: 'finish' as const, reason: 'stop' as const }], delayMs });
const QUESTION = 'quanto gastei em setembro?';

describe('StopRunUseCase', () => {
  it('para em ate 1 s, preserva o parcial, marca interrompida e o proximo envio funciona', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [slow(300), { events: [{ type: 'text_delta', text: 'Resposta nova.' }, { type: 'finish', reason: 'stop' }] }]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const stop = new StopRunUseCase(app.store, app.runs);
    const first = await app.send.execute({ userId: 'u1', text: QUESTION });
    await new Promise((r) => setTimeout(r, 350));
    const startedAt = Date.now();
    assert.deepEqual(await stop.execute({ userId: 'u1', runId: first.runId }), { stopped: true });
    assert.ok(Date.now() - startedAt <= 1000, 'a parada passou de 1 s');
    const messages = await app.store.messages.list('u1', first.conversationId, { limit: 10 });
    const assistant = messages.at(-1);
    assert.equal(assistant?.status, 'interrupted');
    assert.deepEqual(assistant?.parts, [{ type: 'text', text: 'Parcial ' }]);
    assert.equal((await app.store.runs.get('u1', first.runId))?.status, 'cancelled');
    const finished = app.events.findLast((e) => e.type === 'run_finished');
    assert.equal(finished?.type === 'run_finished' && finished.status, 'cancelled');

    const second = await app.send.execute({ userId: 'u1', conversationId: first.conversationId, text: 'e agora?' });
    await app.runs.settled(second.runId);
    assert.equal((await app.store.messages.list('u1', first.conversationId, { limit: 10 })).at(-1)?.status, 'complete');
  });

  it('parar duas vezes, uma execucao ja terminada ou de outro usuario e inofensivo', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [slow(200)]) });
    await app.configure([LOCAL_MAIN]);
    const stop = new StopRunUseCase(app.store, app.runs);
    const run = await app.send.execute({ userId: 'u1', text: QUESTION });
    await new Promise((r) => setTimeout(r, 250));
    assert.equal((await stop.execute({ userId: 'u1', runId: run.runId })).stopped, true);
    assert.equal((await stop.execute({ userId: 'u1', runId: run.runId })).stopped, false);
    assert.equal((await stop.execute({ userId: 'u1', runId: 'nao-existe' })).stopped, false);
    const other = await app.send.execute({ userId: 'u1', text: 'outra pergunta' });
    assert.equal((await stop.execute({ userId: 'intruso', runId: other.runId })).stopped, false);
    assert.equal(app.runs.hasConversation(other.conversationId), true);
    await stop.execute({ userId: 'u1', runId: other.runId });
    await assert.rejects(stop.execute({ userId: 'u1' }), InvalidInputError);
  });
});
