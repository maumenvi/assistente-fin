import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ListAvailableModelsUseCase } from '../../../src/app/agent/use-cases/list.available.models.use.case.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { SystemClock } from '../../../src/libs/clock/system.clock.ts';
import { sendHttpError, startLocalLlmServer, type LocalLlmServer } from '../llm/support/local.llm.server.ts';
import { CLOUD_MAIN, LOCAL_MAIN } from './support/agent.app.harness.ts';

let server: LocalLlmServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const KEY = 'sk-or-v1-LISTAR-MODELOS';

async function setup(profile: typeof LOCAL_MAIN, baseUrl: string) {
  const secrets = new MemorySecretStore();
  const settings = new MemoryAgentSettings(secrets);
  await settings.write('u1', { profiles: [{ ...profile, baseUrl }], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
  return new ListAvailableModelsUseCase({ settings, secrets, fetchFn: (url, init) => fetch(url, init), clock: new SystemClock() });
}

describe('ListAvailableModelsUseCase', () => {
  it('lista os modelos do servidor com janela de contexto e suporte a ferramentas', async () => {
    server = await startLocalLlmServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'llama3', context_length: 8192, supported_parameters: ['tools'] }, { id: 'phi3' }] }));
    });
    const result = await (await setup(LOCAL_MAIN, server.baseUrl)).execute({ userId: 'u1', profileId: 'main' });
    assert.equal(result.error, null);
    assert.deepEqual(result.models, [{ id: 'llama3', contextWindow: 8192, supportsTools: true }, { id: 'phi3' }]);
  });

  it('servidor sem /models devolve lista vazia sem erro (a tela aceita digitar o nome)', async () => {
    server = await startLocalLlmServer((_req, res) => {
      res.writeHead(404).end();
    });
    const result = await (await setup(LOCAL_MAIN, server.baseUrl)).execute({ userId: 'u1', profileId: 'main' });
    assert.deepEqual(result, { models: [], error: null });
  });

  it('erros: servidor local fora do ar, chave invalida (sem vazar a chave) e nuvem sem rede', async () => {
    const local = await (await setup(LOCAL_MAIN, 'http://127.0.0.1:1/v1')).execute({ userId: 'u1', profileId: 'main' });
    assert.equal(local.error, 'local_unreachable');
    server = await startLocalLlmServer((_req, res) => sendHttpError(res, 401, `chave ${KEY} invalida`));
    const auth = await (await setup({ ...CLOUD_MAIN, apiKey: KEY }, server.baseUrl)).execute({ userId: 'u1', profileId: 'main' });
    assert.equal(auth.error, 'invalid_key');
    assert.ok(!JSON.stringify(auth).includes(KEY));
    const offline = await (await setup(CLOUD_MAIN, 'http://127.0.0.1:1/v1')).execute({ userId: 'u1', profileId: 'main' });
    assert.equal(offline.error, 'offline');
  });

  it('perfil inexistente ou entrada invalida lancam InvalidInputError', async () => {
    const useCase = await setup(LOCAL_MAIN, 'http://127.0.0.1:1/v1');
    await assert.rejects(useCase.execute({ userId: 'u1', profileId: 'x' }), /entrada invalida/);
    await assert.rejects(useCase.execute({}), /entrada invalida/);
  });
});
