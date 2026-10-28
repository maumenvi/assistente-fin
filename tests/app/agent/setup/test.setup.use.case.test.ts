import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LocalOnlyViolationError } from '../../../../src/domain/agent/errors/local.only.violation.error.ts';
import { InvalidInputError } from '../../../../src/app/shared/invalid.input.error.ts';
import { type ConnectionReport } from '../../../../src/domain/agent/connection/connection.report.ts';
import { startFakeProvider } from '../../../support/fake.provider.servers.ts';
import { startSetupWorld, USER, type SetupWorld } from './support/setup.harness.ts';

const codes = (r: ConnectionReport): string[] => r.steps.map((s) => s.code);
const statuses = (r: ConnectionReport): string[] => r.steps.map((s) => s.status);

async function withWorld(options: Parameters<typeof startSetupWorld>[0], run: (world: SetupWorld) => Promise<void>): Promise<void> {
  const world = await startSetupWorld(options);
  try {
    await run(world);
  } finally {
    await world.close();
  }
}

describe('TestSetupUseCase - caminho feliz', () => {
  it('OpenRouter: 5 etapas ok, padrao provado, saldo e capacidades', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: ' good-key\n' } });
      assert.deepEqual(codes(r), ['reach.ok', 'key.ok', 'model.ok', 'tools.ok', 'context.ok']);
      assert.equal(r.ok, true);
      assert.equal(r.canSave, true);
      assert.equal(r.model, 'openrouter/auto');
      assert.equal(r.capabilities?.tools, true);
      assert.equal(r.detected.keyInfo?.remainingUsd, 4.5);
    });
  });

  it('Google: ids sem models/ e modelo padrao gemini', async () => {
    await withWorld({ kind: 'google' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'google', apiKey: 'good-key' } });
      assert.equal(r.ok, true);
      assert.equal(r.model, 'gemini-3.8-flash');
      assert.equal(r.steps[1]?.code, 'key.ok');
    });
  });

  it('Ollama: sem chave (key.not_needed), melhor modelo instalado e contexto lido de /api/ps', async () => {
    await withWorld({ kind: 'ollama', models: ['llama3.1:8b', 'qwen3:8b'], contextTokens: 16384 }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'ollama' } });
      assert.deepEqual(codes(r), ['reach.ok', 'key.not_needed', 'model.ok', 'tools.ok', 'context.ok']);
      assert.equal(r.model, 'qwen3:8b');
      assert.equal(r.detected.contextTokens, 16384);
      assert.deepEqual([...r.detected.installedModels], ['llama3.1:8b', 'qwen3:8b']);
    });
  });
});

describe('TestSetupUseCase - cada falha da spec', () => {
  it('chave inexistente no rascunho e no cofre => key.missing e o resto nao verificado', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter' } });
      assert.equal(r.steps[1]?.code, 'key.missing');
      assert.equal(r.canSave, false);
      assert.deepEqual(statuses(r), ['skipped', 'failed', 'skipped', 'skipped', 'skipped']);
    });
  });

  it('chave inválida => key.invalid; as etapas seguintes ficam skipped; o alcance fica ok', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'ruim' } });
      assert.deepEqual(codes(r), ['reach.ok', 'key.invalid', 'model.skipped', 'tools.skipped', 'context.skipped']);
      assert.equal(r.canSave, false);
    });
  });

  it('Google: HTTP 400 "API key not valid" => key.invalid', async () => {
    await withWorld({ kind: 'google' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'google', apiKey: 'ruim' } });
      assert.equal(r.steps[1]?.code, 'key.invalid');
    });
  });

  it('sem credito => key.no_credit', async () => {
    await withWorld({ kind: 'openrouter', keyState: 'no_credit' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      assert.equal(r.steps[1]?.code, 'key.no_credit');
      assert.equal(r.canSave, false);
    });
  });

  it('chave vencida => key.expired', async () => {
    await withWorld({ kind: 'openrouter', keyState: 'expired' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      assert.equal(r.steps[1]?.code, 'key.expired');
    });
  });

  it('chave vencendo em ate 7 dias => aviso key.expiring (ainda salva)', async () => {
    await withWorld({ kind: 'openrouter', keyState: 'expiring' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      assert.equal(r.steps[1]?.status, 'warn');
      assert.equal(r.steps[1]?.code, 'key.expiring');
      assert.equal(r.canSave, true);
    });
  });

  it('sem conexao => reach.offline (nao e culpa da chave); Ollama desligado => reach.local_down', async () => {
    const dead = await startFakeProvider({ kind: 'openrouter' });
    const deadUrl = dead.baseUrl;
    await dead.close();
    const w = await startSetupWorld({ kind: 'openrouter' });
    try {
      const offline = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key', baseUrl: deadUrl } });
      assert.equal(offline.steps[0]?.code, 'reach.offline');
      assert.equal(offline.steps[1]?.code, 'key.skipped');
      const local = await w.test.execute({ userId: USER, draft: { provider: 'ollama', baseUrl: deadUrl.replace('/api/v1', '/v1') } });
      assert.equal(local.steps[0]?.code, 'reach.local_down');
    } finally {
      await w.close();
    }
  });

  it('modelo inexistente (Avancado) => model.not_found com sugestao', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key', model: 'nao/existe' } });
      assert.equal(r.steps[2]?.code, 'model.not_found');
      assert.equal(r.steps[2]?.detail?.['suggestion'], 'openrouter/auto');
      assert.equal(r.canSave, false);
    });
  });

  it('modelo sem ferramentas (Avancado) => aviso tools.unsupported com o padrao sugerido; ainda salva com confirmacao', async () => {
    await withWorld({ kind: 'openrouter', models: ['openrouter/auto', 'x/sem-tools'], supportsTools: (m) => m !== 'x/sem-tools' }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key', model: 'x/sem-tools' } });
      assert.equal(r.steps[3]?.status, 'warn');
      assert.equal(r.steps[3]?.code, 'tools.unsupported');
      assert.equal(r.steps[3]?.detail?.['suggestion'], 'openrouter/auto');
      assert.equal(r.capabilities?.tools, false);
      assert.equal(r.canSave, true);
    });
  });

  it('modelo sem ferramentas como rapido/alternativo nao e problema (tools.not_required)', async () => {
    await withWorld({ kind: 'openrouter', models: ['openrouter/auto', 'x/sem-tools'], supportsTools: (m) => m !== 'x/sem-tools' }, async (w) => {
      const r = await w.test.execute({ userId: USER, role: 'fast', draft: { provider: 'openrouter', apiKey: 'good-key', model: 'x/sem-tools' } });
      assert.equal(r.steps[3]?.code, 'tools.not_required');
      assert.equal(r.steps[3]?.status, 'ok');
    });
  });

  it('Ollama com contexto de 4k (/api/ps) => context.too_small com o valor detectado', async () => {
    await withWorld({ kind: 'ollama', contextTokens: 4096 }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'ollama' } });
      assert.equal(r.steps[4]?.code, 'context.too_small');
      assert.equal(r.steps[4]?.detail?.['tokens'], 4096);
      assert.equal(r.steps[4]?.detail?.['min'], 8192);
      assert.equal(r.canSave, false);
    });
  });

  it('Ollama com 8k => aviso context.short', async () => {
    await withWorld({ kind: 'ollama', contextTokens: 8192 }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'ollama' } });
      assert.equal(r.steps[4]?.code, 'context.short');
      assert.equal(r.canSave, true);
    });
  });

  it('Ollama sem /api/ps usa a sonda de enchimento (truncamento a 4096)', async () => {
    await withWorld({ kind: 'ollama', contextTokens: 4096, hideProcessInfo: true }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'custom', baseUrl: w.server.baseUrl, model: 'qwen3:8b' } });
      assert.equal(w.server.requests.some((q) => q.url === '/api/ps'), true);
      assert.equal(r.detected.contextTokens, 4096);
      assert.equal(r.steps[4]?.code, 'context.too_small');
    });
  });

  it('Ollama sem modelos instalados => model.none_installed com o comando', async () => {
    await withWorld({ kind: 'ollama', models: [] }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'ollama' } });
      assert.equal(r.steps[2]?.code, 'model.none_installed');
      assert.equal(r.steps[2]?.detail?.['command'], 'ollama pull qwen3:8b');
      assert.equal(r.canSave, false);
    });
  });

  it('chave de outro provedor (AIza... no OpenRouter) => aviso key.looks_like_other', async () => {
    await withWorld({ kind: 'openrouter', validKeys: ['AIzaFake'] }, async (w) => {
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'AIzaFake' } });
      assert.equal(r.steps[1]?.code, 'key.looks_like_other');
      assert.equal(r.steps[1]?.status, 'warn');
      assert.equal(r.canSave, true);
    });
  });
});

describe('TestSetupUseCase - regras', () => {
  it('rascunho nao grava nada: cofre e configuracao continuam vazios', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } });
      assert.deepEqual(w.secrets.refs(), []);
      assert.deepEqual((await w.settings.read(USER)).profiles, []);
    });
  });

  it('chave omitida usa a ja guardada no cofre', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await w.secrets.set(`agent.key.${USER}.main`, 'good-key');
      const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter' } });
      assert.equal(r.ok, true);
    });
  });

  it('Android nao tem Ollama; "somente local" recusa a nuvem', async () => {
    await withWorld({ kind: 'ollama', platform: 'android' }, async (w) => {
      await assert.rejects(w.test.execute({ userId: USER, draft: { provider: 'ollama' } }), InvalidInputError);
      await assert.rejects(w.test.execute({ userId: USER, draft: { provider: 'custom', baseUrl: w.server.baseUrl, model: 'qwen3:8b' } }), InvalidInputError);
    });
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await w.settings.write(USER, { profiles: [], localOnly: true, limits: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 } });
      await assert.rejects(w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key' } }), LocalOnlyViolationError);
    });
  });

  it('endereco invalido => entrada invalida', async () => {
    await withWorld({ kind: 'openrouter' }, async (w) => {
      await assert.rejects(w.test.execute({ userId: USER, draft: { provider: 'custom', baseUrl: 'http://exemplo.com/v1' } }), InvalidInputError);
    });
  });
});

describe('TestSetupUseCase - formato do stream (spec 037, FR-017)', () => {
  it('modelo cujo stream vem fora do formato reprova em tools.stream_incompatible com a etapa e nao salva', async () => {
    await withWorld(
      { kind: 'openrouter', models: ['openrouter/auto', 'x/estranho'], streamReply: () => ({ raw: 'data: {"choices": "nao-e-lista"}\n\ndata: [DONE]\n\n' }) },
      async (w) => {
        const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key', model: 'x/estranho' } });
        assert.equal(r.steps[3]?.code, 'tools.stream_incompatible');
        assert.equal(r.steps[3]?.status, 'failed');
        assert.equal(r.steps[3]?.detail?.['stage'], 'chunk_invalido');
        assert.equal(r.canSave, false);
        assert.equal(r.steps[4]?.status, 'skipped');
      },
    );
  });

  it('modelo com campos extras no stream passa', async () => {
    await withWorld(
      { kind: 'openrouter', models: ['openrouter/auto', 'x/extra'], streamReply: () => ({ raw: 'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","content":"ok","novo":1}}],"extra":true}\n\ndata: [DONE]\n\ndata: [DONE]\n\n' }) },
      async (w) => {
        const r = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: 'good-key', model: 'x/extra' } });
        assert.equal(r.ok, true);
        assert.equal(r.steps[3]?.code, 'tools.ok');
      },
    );
  });
});
