import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SetupNotTestedError } from '../../../../src/domain/agent/errors/setup.not.tested.error.ts';
import { startSetupWorld, USER, type SetupWorld } from './support/setup.harness.ts';

async function withWorld(options: Parameters<typeof startSetupWorld>[0], run: (world: SetupWorld) => Promise<void>): Promise<void> {
  const world = await startSetupWorld(options);
  try {
    await run(world);
  } finally {
    await world.close();
  }
}

describe('SaveSetupUseCase', () => {
  it('reexecuta o teste e grava o principal com o modelo provado, as capacidades verificadas e a chave no cofre', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      const { view } = await w.save.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: ' good-key ' } });
      const settings = await w.settings.read(USER);
      const main = settings.profiles[0];
      assert.equal(main?.role, 'main');
      assert.equal(main?.origin, 'openrouter');
      assert.equal(main?.model, 'openrouter/auto');
      assert.equal(main?.capabilities.tools, true);
      assert.notEqual(main?.capabilities.verifiedAt, null);
      assert.equal(await w.secrets.get(main?.keyRef ?? ''), 'good-key');
      assert.equal(view.provider, 'openrouter');
      assert.equal(view.hasKey, true);
      assert.equal(view.configured, true);
      assert.ok(!JSON.stringify(view).includes('good-key'), 'a visao nunca leva a chave');
    });
  });

  it('teste que falha => SETUP_NOT_TESTED e nada gravado (nem chave)', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await assert.rejects(w.save.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'ruim' } }), (e: unknown) => e instanceof SetupNotTestedError && e.code === 'SETUP_NOT_TESTED' && e.report.steps[1]?.code === 'key.invalid');
      assert.deepEqual((await w.settings.read(USER)).profiles, []);
      assert.deepEqual(w.secrets.refs(), []);
    });
  });

  it('aviso (modelo sem ferramentas) exige confirmWarnings', async () => {
    await withWorld({ kind: 'openrouter', models: ['openrouter/auto', 'x/sem-tools'], supportsTools: (m) => m !== 'x/sem-tools' }, async (w) => {
      const draft = { provider: 'openrouter' as const, apiKey: 'good-key', model: 'x/sem-tools' };
      await assert.rejects(w.save.execute({ userId: USER, draft }), SetupNotTestedError);
      assert.deepEqual((await w.settings.read(USER)).profiles, []);
      await w.save.execute({ userId: USER, draft, confirmWarnings: true });
      assert.equal((await w.settings.read(USER)).profiles[0]?.capabilities.tools, false);
    });
  });

  it('preserva rapido, alternativo, limites e "somente local"; trocar a chave com "Substituir"', async () => {
    await withWorld({ kind: 'openrouter', validKeys: ['good-key', 'nova-key'] }, async (w) => {
      const limits = { maxSteps: 7, maxMs: 30_000, maxCostMicroUsd: 50_000 };
      await w.settings.write(USER, {
        profiles: [
          { id: 'fast', role: 'fast', origin: 'openrouter', baseUrl: w.server.baseUrl, model: 'google/gemini-2.5-flash', enabled: true, apiKey: 'good-key' },
          { id: 'fallback', role: 'fallback', origin: 'openrouter', baseUrl: w.server.baseUrl, model: 'openrouter/auto', enabled: true },
        ],
        localOnly: false,
        limits,
      });
      await w.save.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      await w.save.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'nova-key' } });
      const settings = await w.settings.read(USER);
      assert.deepEqual(settings.profiles.map((p) => p.role).sort(), ['fallback', 'fast', 'main']);
      assert.deepEqual(settings.limits, limits);
      const main = settings.profiles.find((p) => p.role === 'main');
      assert.equal(await w.secrets.get(main?.keyRef ?? ''), 'nova-key');
      assert.equal(await w.secrets.get(settings.profiles.find((p) => p.role === 'fast')?.keyRef ?? ''), 'good-key');
    });
  });

  it('chave omitida mantem a ja guardada; Ollama nao grava chave', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await w.save.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      await w.save.execute({ userId: USER, draft: { provider: 'openrouter', model: 'google/gemini-2.5-flash' } });
      const main = (await w.settings.read(USER)).profiles[0];
      assert.equal(main?.model, 'google/gemini-2.5-flash');
      assert.equal(await w.secrets.get(main?.keyRef ?? ''), 'good-key');
    });
    await withWorld({ kind: 'ollama' }, async (w) => {
      await w.save.execute({ userId: USER, draft: { provider: 'ollama' } });
      assert.deepEqual(w.secrets.refs(), []);
      assert.equal((await w.settings.read(USER)).profiles[0]?.origin, 'openai_compat_local');
    });
  });

  it('clearKey apaga a chave do provedor do principal e a visao passa a dizer hasKey=false', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await w.save.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      await w.clearKey.execute({ userId: USER, provider: 'google' });
      assert.equal((await w.getView.execute(USER)).hasKey, true, 'outro provedor nao apaga');
      assert.deepEqual(await w.clearKey.execute({ userId: USER, provider: 'openrouter' }), { hasKey: false });
      assert.equal((await w.getView.execute(USER)).hasKey, false);
      assert.deepEqual(w.secrets.refs(), []);
    });
  });
});
