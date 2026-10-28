import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultLimitsForm, limitsFormFromBudget, parseLimitsForm } from '../../../src/app/agent/view/settings/limits.form.ts';
import { buildSettingsInput, emptySettingsForm, settingsFormFromView } from '../../../src/app/agent/view/settings/settings.form.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { agentSettingsInputSchema } from '../../../src/app/agent/settings/agent.settings.input.schema.ts';

describe('limites por pedido (tela)', () => {
  it('padrao 40 / 300 / 1,00 e ida-e-volta', () => {
    assert.deepEqual(defaultLimitsForm(), { steps: '40', seconds: '300', costUsd: '1,00' });
    const parsed = parseLimitsForm(defaultLimitsForm());
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.ok && parsed.budget, DEFAULT_RUN_BUDGET);
    assert.equal(limitsFormFromBudget({ maxSteps: 3, maxMs: 7000, maxCostMicroUsd: 2_500_000 }).costUsd, '2,50');
  });

  it('aceita ponto ou virgula no custo; recusa fora das faixas', () => {
    assert.ok(parseLimitsForm({ steps: '100', seconds: '1800', costUsd: '20.00' }).ok);
    assert.ok(parseLimitsForm({ steps: '1', seconds: '5', costUsd: '0,01' }).ok);
    for (const bad of [{ steps: '0' }, { steps: '101' }, { steps: '1,5' }, { seconds: '4' }, { seconds: '1801' }, { costUsd: '0,005' }, { costUsd: '20,01' }, { costUsd: '' }, { costUsd: 'abc' }]) {
      const result = parseLimitsForm({ ...defaultLimitsForm(), ...bad });
      assert.equal(result.ok, false, JSON.stringify(bad));
    }
  });
});

describe('principal sem ferramentas (spec 035, FR-010)', () => {
  const noTools = { tools: false, parallelToolCalls: false, vision: false, structuredOutput: false, contextWindow: 32_000, promptCache: 'none' as const, reasoning: false, verifiedAt: '2026-10-23T10:00:00Z' };
  const formWith = (capabilities: typeof noTools | null) => {
    const form = emptySettingsForm();
    return { ...form, profiles: { ...form.profiles, main: { ...form.profiles.main, model: 'x/sem-tools', capabilities } } };
  };
  it('principal verificado SEM ferramentas pede confirmacao; com confirmacao salva', () => {
    const blocked = buildSettingsInput(formWith(noTools), { allowLocal: true });
    assert.equal(blocked.ok, false);
    assert.equal(!blocked.ok && blocked.needsNoToolsConfirm, true);
    assert.equal(!blocked.ok && blocked.noToolsModel, 'x/sem-tools');
    assert.match(!blocked.ok ? (blocked.errors[0] ?? '') : '', /não consulta os seus dados/);
    assert.ok(buildSettingsInput(formWith(noTools), { allowLocal: true, confirmNoTools: true }).ok);
  });
  it('com ferramentas ou nao verificado, nao pede nada', () => {
    assert.ok(buildSettingsInput(formWith({ ...noTools, tools: true }), { allowLocal: true }).ok);
    assert.ok(buildSettingsInput(formWith(null), { allowLocal: true }).ok);
  });
});

describe('formulario de configuracao dos modelos', () => {
  it('sem principal escolhido nao salva', () => {
    const result = buildSettingsInput(emptySettingsForm(), { allowLocal: true });
    assert.deepEqual(result, { ok: false, errors: ['Escolha o modelo principal.'] });
  });

  it('so os papeis com modelo entram; a chave so vai se foi digitada; passa pela validacao do caso de uso', () => {
    const form = emptySettingsForm();
    const withMain = { ...form, profiles: { ...form.profiles, main: { ...form.profiles.main, model: ' anthropic/claude-sonnet ', apiKey: 'sk-x' } } };
    const result = buildSettingsInput(withMain, { allowLocal: false });
    assert.ok(result.ok);
    assert.equal(result.ok && result.input.profiles.length, 1);
    assert.equal(result.ok && result.input.profiles[0]?.apiKey, 'sk-x');
    assert.equal(result.ok && result.input.profiles[0]?.model, 'anthropic/claude-sonnet');
    assert.equal(agentSettingsInputSchema.safeParse(result.ok && result.input).success, true);
    const keep = buildSettingsInput({ ...withMain, profiles: { ...withMain.profiles, main: { ...withMain.profiles.main, apiKey: '', hasKey: true } } }, { allowLocal: false });
    assert.ok(keep.ok && !('apiKey' in (keep.input.profiles[0] as object)));
  });

  it('modelo local so no computador; endereco obrigatorio; limites invalidos entram nos erros', () => {
    const form = emptySettingsForm();
    const local = { ...form.profiles.main, model: 'llama3', origin: 'openai_compat_local' as const, baseUrl: '' };
    const result = buildSettingsInput({ ...form, profiles: { ...form.profiles, main: local }, limits: { ...form.limits, steps: '0' } }, { allowLocal: false });
    assert.equal(result.ok, false);
    const errors = result.ok ? [] : result.errors;
    assert.ok(errors.some((e) => /só existem no computador/.test(e)));
    assert.ok(errors.some((e) => /endereço/.test(e)));
    assert.ok(errors.some((e) => /Passos/.test(e)));
  });

  it('visao guardada -> formulario sem chave; capacidades so se verificadas', () => {
    const form = settingsFormFromView({
      profiles: [{ id: 'main', role: 'main', origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'm', enabled: true, hasKey: true, capabilities: { tools: true, parallelToolCalls: false, vision: false, structuredOutput: false, contextWindow: 32000, promptCache: 'none', reasoning: false, verifiedAt: '2026-10-22T00:00:00Z' } }],
      localOnly: true,
      limits: DEFAULT_RUN_BUDGET,
    });
    assert.equal(form.profiles.main.apiKey, '');
    assert.equal(form.profiles.main.hasKey, true);
    assert.equal(form.profiles.main.capabilities?.tools, true);
    assert.equal(form.profiles.fast.model, '');
    assert.equal(form.localOnly, true);
  });
});
