import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { DEFAULT_RUN_BUDGET, LEGACY_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { agentSettingsInputSchema } from '../../../src/app/agent/settings/agent.settings.input.schema.ts';
import { agentSettingsSchema } from '../../../src/app/agent/settings/agent.settings.schema.ts';
import { baseUrlSchema } from '../../../src/app/agent/settings/base.url.schema.ts';
import { CLOUD_CONSENT_TEXT } from '../../../src/app/agent/settings/cloud.consent.text.ts';
import { CLOUD_CONSENT_VERSION } from '../../../src/app/agent/settings/cloud.consent.version.ts';
import { toAgentSettingsView } from '../../../src/app/agent/settings/to.agent.settings.view.ts';

const profile = { id: 'p1', role: 'main', origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet', keyRef: 'agent.p1', capabilities: CONSERVATIVE_CAPABILITIES, enabled: true };

describe('baseUrlSchema', () => {
  it('aceita https e http local; tira a barra final', () => {
    assert.equal(baseUrlSchema.parse('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1');
    assert.equal(baseUrlSchema.parse('http://localhost:11434/v1'), 'http://localhost:11434/v1');
    assert.equal(baseUrlSchema.parse('http://127.0.0.1:8080/v1'), 'http://127.0.0.1:8080/v1');
    assert.equal(baseUrlSchema.parse('http://[::1]:8080/v1'), 'http://[::1]:8080/v1');
  });

  it('recusa http fora do local, credenciais no endereco e lixo', () => {
    for (const bad of ['http://exemplo.com/v1', 'https://user:senha@exemplo.com', 'ftp://x', 'nao e url', '']) {
      assert.equal(baseUrlSchema.safeParse(bad).success, false, bad);
    }
  });
});

describe('agentSettingsSchema', () => {
  it('le uma configuracao valida e aplica os padroes (somente-local desligado, limites 12/60/0,10)', () => {
    const parsed = agentSettingsSchema.parse({ profiles: [profile] });
    assert.equal(parsed.localOnly, false);
    assert.deepEqual(parsed.limits, DEFAULT_RUN_BUDGET);
  });

  it('um perfil por papel', () => {
    assert.equal(agentSettingsSchema.safeParse({ profiles: [profile, { ...profile, id: 'p2' }] }).success, false);
    assert.equal(agentSettingsSchema.safeParse({ profiles: [profile, { ...profile, id: 'p2', role: 'fast' }] }).success, true);
  });

  it('limites guardados no padrao antigo (12 / 60 s / US$ 0,10) passam ao novo padrao; limites personalizados ficam como estao', () => {
    const legacy = agentSettingsSchema.parse({ profiles: [], limits: { ...LEGACY_RUN_BUDGET } });
    assert.deepEqual(legacy.limits, { ...DEFAULT_RUN_BUDGET });
    const custom = agentSettingsSchema.parse({ profiles: [], limits: { maxSteps: 12, maxMs: 90_000, maxCostMicroUsd: 100_000 } });
    assert.equal(custom.limits.maxMs, 90_000);
  });

  it('no maximo 3 perfis e limites dentro da faixa', () => {
    const three = (['main', 'fast', 'fallback'] as const).map((role, i) => ({ ...profile, id: `p${i}`, role }));
    assert.equal(agentSettingsSchema.safeParse({ profiles: [...three, { ...profile, id: 'x', role: 'main' }] }).success, false);
    for (const limits of [{ ...DEFAULT_RUN_BUDGET, maxSteps: 0 }, { ...DEFAULT_RUN_BUDGET, maxSteps: 101 }, { ...DEFAULT_RUN_BUDGET, maxMs: 1000 }, { ...DEFAULT_RUN_BUDGET, maxCostMicroUsd: 20_000_001 }]) {
      assert.equal(agentSettingsSchema.safeParse({ profiles: [], limits }).success, false);
    }
  });
});

describe('agentSettingsInputSchema', () => {
  it('a chave so existe na entrada, e perfil de entrada nao tem keyRef', () => {
    const { keyRef: _ignored, capabilities: _caps, ...rest } = profile;
    const parsed = agentSettingsInputSchema.parse({ profiles: [{ ...rest, apiKey: '  sk-or-v1-abc  ' }], localOnly: false, limits: DEFAULT_RUN_BUDGET });
    assert.equal(parsed.profiles[0]?.apiKey, 'sk-or-v1-abc');
    assert.equal('keyRef' in (parsed.profiles[0] ?? {}), false);
  });

  it('chave vazia e recusada; sem chave e valido (mantem a guardada)', () => {
    const { keyRef: _a, capabilities: _b, ...rest } = profile;
    assert.equal(agentSettingsInputSchema.safeParse({ profiles: [{ ...rest, apiKey: '   ' }], localOnly: false, limits: DEFAULT_RUN_BUDGET }).success, false);
    assert.equal(agentSettingsInputSchema.safeParse({ profiles: [rest], localOnly: false, limits: DEFAULT_RUN_BUDGET }).success, true);
  });
});

describe('toAgentSettingsView', () => {
  it('a visao nunca leva keyRef nem chave; so hasKey', () => {
    const settings = agentSettingsSchema.parse({ profiles: [profile, { ...profile, id: 'p2', role: 'fast', keyRef: null }] });
    const view = toAgentSettingsView(settings, (ref) => ref === 'agent.p1');
    assert.deepEqual(view.profiles.map((p) => p.hasKey), [true, false]);
    assert.equal(JSON.stringify(view).includes('keyRef'), false);
    assert.equal(JSON.stringify(view).includes('agent.p1'), false);
  });

  it('keyRef sem segredo guardado -> hasKey falso', () => {
    const view = toAgentSettingsView(agentSettingsSchema.parse({ profiles: [profile] }), () => false);
    assert.equal(view.profiles[0]?.hasKey, false);
  });
});

describe('consentimento de nuvem', () => {
  it('versao e texto explicam o que sai, para quem e como revogar', () => {
    assert.equal(CLOUD_CONSENT_VERSION, 'agent-cloud-v1');
    const text = CLOUD_CONSENT_TEXT.paragraphs.join(' ');
    assert.match(text, /pergunta/);
    assert.match(text, /nunca é enviada/);
    assert.match(text, /revogar/);
  });
});
