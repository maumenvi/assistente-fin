import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { type ServerResponse } from 'node:http';
import { TestConnectionUseCase } from '../../../src/app/agent/use-cases/test.connection.use.case.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { LocalOnlyViolationError } from '../../../src/domain/agent/errors/local.only.violation.error.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { SystemClock } from '../../../src/libs/clock/system.clock.ts';
import { startLocalLlmServer, sendHttpError, type LocalLlmServer, type RecordedRequest } from '../llm/support/local.llm.server.ts';
import { CLOUD_MAIN, LOCAL_MAIN } from './support/agent.app.harness.ts';

let server: LocalLlmServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const KEY = 'sk-or-v1-TESTE-DE-CONEXAO';

function json(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
const toolAnswer = { choices: [{ message: { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'ping', arguments: '{"echo":"ok"}' } }] } }] };
const textAnswer = { choices: [{ message: { content: 'ok' } }] };

async function setup(handler: (request: RecordedRequest, res: ServerResponse) => void, options: { cloud?: boolean; localOnly?: boolean; model?: string } = {}) {
  server = await startLocalLlmServer(handler);
  const secrets = new MemorySecretStore();
  const settings = new MemoryAgentSettings(secrets);
  const base = options.cloud ? { ...CLOUD_MAIN, apiKey: KEY } : LOCAL_MAIN;
  await settings.write('u1', { profiles: [{ ...base, baseUrl: server.baseUrl, model: options.model ?? 'fake-model' }], localOnly: options.localOnly ?? false, limits: { ...DEFAULT_RUN_BUDGET } });
  return { settings, test: new TestConnectionUseCase({ settings, secrets, fetchFn: (url, init) => fetch(url, init), clock: new SystemClock() }) };
}

const models = { data: [{ id: 'fake-model', context_length: 64_000, supported_parameters: ['tools'] }] };

describe('TestConnectionUseCase', () => {
  it('ok: latencia, capacidades verificadas (ferramentas sim) e gravadas no perfil', async () => {
    const t = await setup((req, res) => (req.url.endsWith('/models') ? json(res, models) : json(res, toolAnswer)));
    const result = await t.test.execute({ userId: 'u1', profileId: 'main' });
    assert.equal(result.ok, true);
    assert.equal(result.capabilities?.tools, true);
    assert.equal(result.capabilities?.contextWindow, 64_000);
    assert.deepEqual(result.warnings, []);
    const saved = (await t.settings.read('u1')).profiles[0];
    assert.equal(saved?.capabilities.tools, true);
    assert.ok(saved?.capabilities.verifiedAt);
  });

  it('modelo sem ferramentas: ok com aviso e tools:false gravado', async () => {
    const t = await setup((req, res) => (req.url.endsWith('/models') ? json(res, { data: [{ id: 'fake-model' }] }) : json(res, textAnswer)));
    const result = await t.test.execute({ userId: 'u1', profileId: 'main' });
    assert.equal(result.ok, true);
    assert.equal(result.capabilities?.tools, false);
    assert.match(result.warnings[0] ?? '', /ferramentas de forma confiável/);
    assert.equal((await t.settings.read('u1')).profiles[0]?.capabilities.tools, false);
  });

  it('401 vira invalid_key e a chave nunca aparece no resultado', async () => {
    const t = await setup((_req, res) => sendHttpError(res, 401, `chave ${KEY} invalida`), { cloud: true });
    const result = await t.test.execute({ userId: 'u1', profileId: 'main' });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'invalid_key');
    assert.ok(!JSON.stringify(result).includes(KEY));
  });

  it('modelo ausente da lista: model_unavailable, sem gravar nada', async () => {
    const t = await setup((req, res) => (req.url.endsWith('/models') ? json(res, models) : json(res, toolAnswer)), { model: 'outro-modelo' });
    const result = await t.test.execute({ userId: 'u1', profileId: 'main' });
    assert.equal(result.error, 'model_unavailable');
    assert.equal((await t.settings.read('u1')).profiles[0]?.capabilities.verifiedAt, null);
  });

  it('402 vira quota; servidor local fora do ar vira local_unreachable; nuvem sem rede vira offline', async () => {
    const quota = await setup((_req, res) => sendHttpError(res, 402, 'sem creditos'), { cloud: true });
    assert.equal((await quota.test.execute({ userId: 'u1', profileId: 'main' })).error, 'quota');
    await server?.close();
    const secrets = new MemorySecretStore();
    const settings = new MemoryAgentSettings(secrets);
    await settings.write('u1', { profiles: [{ ...LOCAL_MAIN, baseUrl: 'http://127.0.0.1:1/v1' }], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
    const local = new TestConnectionUseCase({ settings, secrets, fetchFn: (url, init) => fetch(url, init), clock: new SystemClock() });
    assert.equal((await local.execute({ userId: 'u1', profileId: 'main' })).error, 'local_unreachable');
    await settings.write('u1', { profiles: [{ ...CLOUD_MAIN, baseUrl: 'http://127.0.0.1:1/v1' }], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
    assert.equal((await local.execute({ userId: 'u1', profileId: 'main' })).error, 'offline');
  });

  it('somente local recusa perfil de nuvem; perfil inexistente e entrada invalida', async () => {
    const t = await setup((_req, res) => json(res, models), { cloud: true, localOnly: true });
    await assert.rejects(t.test.execute({ userId: 'u1', profileId: 'main' }), LocalOnlyViolationError);
    await assert.rejects(t.test.execute({ userId: 'u1', profileId: 'nao-existe' }), /entrada invalida/);
    await assert.rejects(t.test.execute({ userId: '', profileId: 'main' }), /entrada invalida/);
  });
});
