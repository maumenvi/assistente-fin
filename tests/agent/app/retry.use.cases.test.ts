import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RetryLastUseCase } from '../../../src/app/agent/use-cases/retry.last.use.case.ts';
import { RetryWithFallbackUseCase } from '../../../src/app/agent/use-cases/retry.with.fallback.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { NoFallbackConfiguredError } from '../../../src/domain/agent/errors/no.fallback.configured.error.ts';
import { NothingToRetryError } from '../../../src/domain/agent/errors/nothing.to.retry.error.ts';
import { RunAlreadyActiveError } from '../../../src/domain/agent/errors/run.already.active.error.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_FALLBACK, LOCAL_MAIN, makeAgentApp } from './support/agent.app.harness.ts';

const say = (text: string, delayMs = 0) => ({ events: [{ type: 'text_delta' as const, text }, { type: 'finish' as const, reason: 'stop' as const }], delayMs });
const QUESTION = 'quanto gastei em setembro?';

function retries(app: ReturnType<typeof makeAgentApp>) {
  return { last: new RetryLastUseCase(app.send), fallback: new RetryWithFallbackUseCase(app.send) };
}

async function messagesOf(app: ReturnType<typeof makeAgentApp>, conversationId: string) {
  return app.store.messages.list('u1', conversationId, { limit: 50 });
}

describe('tentar de novo', () => {
  it('apos erro: nova execucao ligada a mesma pergunta; nao duplica a pergunta e a resposta original permanece', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_UNAVAILABLE' } }, say('Não encontrei lançamentos.')]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const first = await app.send.execute({ userId: 'u1', text: QUESTION });
    await app.runs.settled(first.runId);
    const failed = (await messagesOf(app, first.conversationId)).at(-1);
    assert.equal(failed?.status, 'error');

    const second = await retries(app).last.execute({ userId: 'u1', conversationId: first.conversationId, messageId: failed?.id });
    await app.runs.settled(second.runId);
    const messages = await messagesOf(app, first.conversationId);
    assert.deepEqual(messages.map((m) => [m.role, m.status]), [['user', 'complete'], ['assistant', 'error'], ['assistant', 'complete']]);
    const run = await app.store.runs.get('u1', second.runId);
    assert.equal(run?.userMessageId, messages[0]?.id);
    assert.equal(run?.status, 'done');
  });

  it('apos interrupcao: tenta de novo e a pergunta continua uma so', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [say('Parcial', 300), say('Resposta completa.')]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const first = await app.send.execute({ userId: 'u1', text: QUESTION });
    setTimeout(() => app.runs.cancel(first.runId), 30);
    await app.runs.settled(first.runId);
    const interrupted = (await messagesOf(app, first.conversationId)).at(-1);
    assert.equal(interrupted?.status, 'interrupted');
    const second = await retries(app).last.execute({ userId: 'u1', conversationId: first.conversationId, messageId: interrupted?.id });
    await app.runs.settled(second.runId);
    const messages = await messagesOf(app, first.conversationId);
    assert.equal(messages.filter((m) => m.role === 'user').length, 1);
    assert.equal(messages.at(-1)?.status, 'complete');
  });

  it('"Usar modelo alternativo" forca o perfil fallback; sem fallback, erro claro', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_AUTH' } }]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [say('Resposta do alternativo.')]);
    const app = makeAgentApp({ llm: main, fallback });
    await app.configure([LOCAL_MAIN, LOCAL_FALLBACK]);
    const first = await app.send.execute({ userId: 'u1', text: QUESTION });
    await app.runs.settled(first.runId);
    const failed = (await messagesOf(app, first.conversationId)).at(-1);
    const second = await retries(app).fallback.execute({ userId: 'u1', conversationId: first.conversationId, messageId: failed?.id });
    await app.runs.settled(second.runId);
    assert.equal(fallback.requests.length, 1);
    assert.equal(main.requests.length, 1, 'o principal nao foi chamado de novo');
    const run = await app.store.runs.get('u1', second.runId);
    assert.equal(run?.profileIds.fallbackUsed, true);
    assert.equal(run?.model, 'llama3-fallback');

    const solo = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_AUTH' } }]) });
    await solo.configure([LOCAL_MAIN]);
    const soloRun = await solo.send.execute({ userId: 'u1', text: QUESTION });
    await solo.runs.settled(soloRun.runId);
    const soloFailed = (await messagesOf(solo, soloRun.conversationId)).at(-1);
    await assert.rejects(retries(solo).fallback.execute({ userId: 'u1', conversationId: soloRun.conversationId, messageId: soloFailed?.id }), NoFallbackConfiguredError);
  });

  it('so refaz a ULTIMA resposta que terminou mal; resposta boa, antiga, durante execucao ou de outro usuario sao recusadas', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [say('Ok.'), say('Ok de novo.', 200)]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const first = await app.send.execute({ userId: 'u1', text: QUESTION });
    await app.runs.settled(first.runId);
    const good = (await messagesOf(app, first.conversationId)).at(-1);
    const { last } = retries(app);
    await assert.rejects(last.execute({ userId: 'u1', conversationId: first.conversationId, messageId: good?.id }), NothingToRetryError);
    await assert.rejects(last.execute({ userId: 'u1', conversationId: first.conversationId, messageId: 'nao-existe' }), NothingToRetryError);
    await assert.rejects(last.execute({ userId: 'u1', conversationId: 'nao-existe', messageId: good?.id }), InvalidInputError);
    await assert.rejects(last.execute({ userId: 'u1' }), InvalidInputError);
    const second = await app.send.execute({ userId: 'u1', conversationId: first.conversationId, text: 'e outubro?' });
    await assert.rejects(last.execute({ userId: 'u1', conversationId: first.conversationId, messageId: good?.id }), RunAlreadyActiveError);
    await app.runs.settled(second.runId);
    await assert.rejects(last.execute({ userId: 'outro', conversationId: first.conversationId, messageId: good?.id }), InvalidInputError);
  });
});
