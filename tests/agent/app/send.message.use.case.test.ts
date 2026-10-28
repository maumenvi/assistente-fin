import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConsentRequiredError } from '../../../src/domain/agent/errors/consent.required.error.ts';
import { LocalOnlyViolationError } from '../../../src/domain/agent/errors/local.only.violation.error.ts';
import { NoModelConfiguredError } from '../../../src/domain/agent/errors/no.model.configured.error.ts';
import { RunAlreadyActiveError } from '../../../src/domain/agent/errors/run.already.active.error.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { CLOUD_CONSENT_VERSION } from '../../../src/app/agent/settings/cloud.consent.version.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { CLOUD_MAIN, LOCAL_MAIN, makeAgentApp } from './support/agent.app.harness.ts';

const answer = (text: string, delayMs = 0) => ({ events: [{ type: 'text_delta' as const, text }, { type: 'finish' as const, reason: 'stop' as const }], delayMs });
const QUESTION = 'quanto gastei em setembro?';

describe('SendMessageUseCase', () => {
  it('devolve na hora; a resposta chega depois, por eventos, na ordem', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer('Não encontrei lançamentos em set/2026.', 40)]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const result = await app.send.execute({ userId: 'u1', text: QUESTION });
    assert.ok(result.runId && result.conversationId);
    assert.equal(app.runs.hasConversation(result.conversationId), true);
    assert.equal(app.events[0]?.type, 'run_started');
    assert.ok(!app.events.some((e) => e.type === 'run_finished'));
    await app.runs.settled(result.runId);
    const types = app.events.map((e) => e.type);
    assert.equal(types[0], 'run_started');
    assert.equal(types.at(-1), 'run_finished');
    assert.ok(types.includes('text_delta'));
    assert.equal(app.runs.hasConversation(result.conversationId), false);
    const messages = await app.store.messages.list('u1', result.conversationId, { limit: 10 });
    assert.deepEqual(messages.map((m) => [m.role, m.status]), [['user', 'complete'], ['assistant', 'complete']]);
    assert.equal(messages[1]?.runId, result.runId);
    const conversation = await app.store.conversations.get('u1', result.conversationId);
    assert.equal(conversation?.title, QUESTION);
    const run = await app.store.runs.get('u1', result.runId);
    assert.equal(run?.status, 'done');
  });

  it('sem modelo principal: NoModelConfiguredError e nada e gravado', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [answer('x')]) });
    await assert.rejects(app.send.execute({ userId: 'u1', text: QUESTION }), NoModelConfiguredError);
    assert.deepEqual(await app.store.conversations.list('u1', { limit: 10 }), []);
  });

  it('nuvem sem consentimento: ConsentRequiredError antes de montar o modelo (nenhuma rede)', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [answer('x')]) });
    await app.configure([CLOUD_MAIN]);
    await assert.rejects(app.send.execute({ userId: 'u1', text: QUESTION }), ConsentRequiredError);
    assert.deepEqual(app.madeProfiles, []);
    assert.deepEqual(await app.store.conversations.list('u1', { limit: 10 }), []);
  });

  it('com consentimento a nuvem funciona; somente local bloqueia a nuvem', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer('Sem dados.')]);
    const app = makeAgentApp({ llm });
    await app.configure([CLOUD_MAIN]);
    await app.settings.recordConsent('u1', { kind: 'cloud', acceptedAt: '2026-10-22T00:00:00Z', textVersion: CLOUD_CONSENT_VERSION });
    const result = await app.send.execute({ userId: 'u1', text: QUESTION });
    await app.runs.settled(result.runId);
    await app.configure([CLOUD_MAIN], { localOnly: true });
    await assert.rejects(app.send.execute({ userId: 'u1', text: QUESTION }), LocalOnlyViolationError);
  });

  it('segunda mensagem enquanto a primeira roda: RunAlreadyActiveError; depois de terminar, funciona', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer('Resposta.', 30)]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const first = await app.send.execute({ userId: 'u1', text: QUESTION });
    await assert.rejects(app.send.execute({ userId: 'u1', conversationId: first.conversationId, text: 'e em outubro?' }), RunAlreadyActiveError);
    await app.runs.settled(first.runId);
    const second = await app.send.execute({ userId: 'u1', conversationId: first.conversationId, text: 'e em outubro?' });
    await app.runs.settled(second.runId);
    assert.equal((await app.store.messages.list('u1', first.conversationId, { limit: 10 })).length, 4);
  });

  it('texto invalido (vazio ou maior que 4000) e conversa de outro usuario sao recusados', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [answer('x')]) });
    await app.configure([LOCAL_MAIN]);
    await assert.rejects(app.send.execute({ userId: 'u1', text: '   ' }), InvalidInputError);
    await assert.rejects(app.send.execute({ userId: 'u1', text: 'a'.repeat(4001) }), InvalidInputError);
    const ok = await app.send.execute({ userId: 'u1', text: QUESTION });
    await app.runs.settled(ok.runId);
    await app.settings.write('outro', { profiles: [LOCAL_MAIN], localOnly: false, limits: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 } });
    await assert.rejects(app.send.execute({ userId: 'outro', conversationId: ok.conversationId, text: QUESTION }), InvalidInputError);
  });

  it('falha do modelo: mensagem do assistente fica como erro com o codigo e run_finished failed', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_AUTH' } }]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const result = await app.send.execute({ userId: 'u1', text: QUESTION });
    await app.runs.settled(result.runId);
    const assistant = (await app.store.messages.list('u1', result.conversationId, { limit: 10 })).at(-1);
    assert.equal(assistant?.status, 'error');
    assert.equal(assistant?.errorCode, 'LLM_AUTH');
    const finished = app.events.at(-1);
    assert.equal(finished?.type === 'run_finished' && finished.status, 'failed');
  });

  it('cancelar interrompe: mensagem interrompida e run cancelled', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'Parcial' }, { type: 'text_delta', text: ' mais' }, { type: 'finish', reason: 'stop' }], delayMs: 25 }]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const result = await app.send.execute({ userId: 'u1', text: QUESTION });
    setTimeout(() => app.runs.cancel(result.runId), 35);
    await app.runs.settled(result.runId);
    const assistant = (await app.store.messages.list('u1', result.conversationId, { limit: 10 })).at(-1);
    assert.equal(assistant?.status, 'interrupted');
    assert.equal((await app.store.runs.get('u1', result.runId))?.status, 'cancelled');
  });
});
