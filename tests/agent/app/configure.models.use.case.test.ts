import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigureModelsUseCase } from '../../../src/app/agent/use-cases/configure.models.use.case.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { at, makeConversation, makeNewMessage, makeRun } from '../store/support/agent.fixtures.ts';
import { CLOUD_MAIN, LOCAL_MAIN } from './support/agent.app.harness.ts';

const LIMITS = { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 };
const KEY = 'sk-or-v1-CONFIGURAR-123';

function setup(allowLocal = true) {
  const secrets = new MemorySecretStore();
  const settings = new MemoryAgentSettings(secrets);
  return { secrets, settings, configure: new ConfigureModelsUseCase({ settings, secrets, allowLocal }) };
}

describe('ConfigureModelsUseCase', () => {
  it('salva a chave no cofre e a visao so informa hasKey (nunca o valor)', async () => {
    const t = setup();
    const view = await t.configure.set({ userId: 'u1', profiles: [{ ...CLOUD_MAIN, apiKey: KEY }], localOnly: false, limits: LIMITS });
    assert.equal(view.profiles[0]?.hasKey, true);
    assert.ok(!JSON.stringify(view).includes(KEY));
    assert.ok(!('keyRef' in (view.profiles[0] as object)));
    assert.equal(await t.secrets.get('agent.key.u1.main'), KEY);
    const again = await t.configure.get({ userId: 'u1' });
    assert.equal(again.profiles[0]?.hasKey, true);
    assert.ok(!JSON.stringify(again).includes(KEY));
  });

  it('salvar sem apiKey mantem a chave; remover o perfil apaga a chave do cofre', async () => {
    const t = setup();
    await t.configure.set({ userId: 'u1', profiles: [{ ...CLOUD_MAIN, apiKey: KEY }], localOnly: false, limits: LIMITS });
    const { apiKey: _omit, ...withoutKey } = CLOUD_MAIN;
    await t.configure.set({ userId: 'u1', profiles: [{ ...withoutKey, model: 'outro/modelo' }], localOnly: false, limits: LIMITS });
    assert.equal(await t.secrets.get('agent.key.u1.main'), KEY);
    await t.configure.set({ userId: 'u1', profiles: [], localOnly: false, limits: LIMITS });
    assert.equal(await t.secrets.get('agent.key.u1.main'), null);
  });

  it('um perfil por papel; endereco https (http so localhost); limites nas faixas', async () => {
    const t = setup();
    const base = { userId: 'u1', localOnly: false, limits: LIMITS };
    await assert.rejects(t.configure.set({ ...base, profiles: [LOCAL_MAIN, { ...LOCAL_MAIN, id: 'dup' }] }), InvalidInputError);
    await assert.rejects(t.configure.set({ ...base, profiles: [{ ...CLOUD_MAIN, baseUrl: 'http://openrouter.ai/api/v1' }] }), InvalidInputError);
    await assert.rejects(t.configure.set({ ...base, profiles: [{ ...CLOUD_MAIN, baseUrl: 'https://u:p@openrouter.ai/v1' }] }), InvalidInputError);
    for (const limits of [{ ...LIMITS, maxSteps: 0 }, { ...LIMITS, maxSteps: 101 }, { ...LIMITS, maxMs: 4_999 }, { ...LIMITS, maxMs: 1_800_001 }, { ...LIMITS, maxCostMicroUsd: 9_999 }, { ...LIMITS, maxCostMicroUsd: 20_000_001 }]) {
      await assert.rejects(t.configure.set({ ...base, profiles: [LOCAL_MAIN], limits }), InvalidInputError);
    }
    await t.configure.set({ ...base, profiles: [LOCAL_MAIN], limits: { maxSteps: 100, maxMs: 1_800_000, maxCostMicroUsd: 20_000_000 } });
    await t.configure.set({ ...base, profiles: [LOCAL_MAIN], limits: { maxSteps: 1, maxMs: 5_000, maxCostMicroUsd: 10_000 } });
  });

  it('modelo local so quando a borda permite (Android recusa)', async () => {
    const android = setup(false);
    await assert.rejects(android.configure.set({ userId: 'u1', profiles: [LOCAL_MAIN], localOnly: false, limits: LIMITS }), InvalidInputError);
    await android.configure.set({ userId: 'u1', profiles: [CLOUD_MAIN], localOnly: false, limits: LIMITS });
    const desktop = setup(true);
    await desktop.configure.set({ userId: 'u1', profiles: [LOCAL_MAIN], localOnly: false, limits: LIMITS });
  });

  it('localOnly e gravado e a configuracao e isolada por usuario', async () => {
    const t = setup();
    await t.configure.set({ userId: 'u1', profiles: [CLOUD_MAIN], localOnly: true, limits: LIMITS });
    assert.equal((await t.configure.get({ userId: 'u1' })).localOnly, true);
    assert.deepEqual((await t.configure.get({ userId: 'u2' })).profiles, []);
    await assert.rejects(t.configure.get({ userId: '' }), InvalidInputError);
  });

  it('SC-008: trocar o modelo principal ou o modo localOnly NAO altera conversas, mensagens nem execucoes', async () => {
    const t = setup();
    const store = new FakeAgentStore();
    await store.conversations.create(makeConversation('c1', 'u1'));
    await store.messages.append(makeNewMessage('m1', 'c1', 'u1'));
    await store.runs.create(makeRun('r1', 'c1', 'u1', { startedAt: at(2) }));
    const snapshot = async () => JSON.stringify([await store.conversations.list('u1', { limit: 10 }), await store.messages.list('u1', 'c1', { limit: 10 }), await store.runs.get('u1', 'r1')]);
    const before = await snapshot();
    await t.configure.set({ userId: 'u1', profiles: [CLOUD_MAIN], localOnly: false, limits: LIMITS });
    await t.configure.set({ userId: 'u1', profiles: [{ ...LOCAL_MAIN, model: 'outro' }], localOnly: true, limits: LIMITS });
    assert.equal(await snapshot(), before);
  });
});
