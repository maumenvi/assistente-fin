import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { applySettingsInput } from '../../../src/app/agent/settings/apply.settings.input.ts';
import { emptyAgentSettings } from '../../../src/app/agent/settings/empty.agent.settings.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { type AgentSettingsInput } from '../../../src/app/agent/ports/settings/agent.settings.input.ts';
import { type ModelProfileInput } from '../../../src/app/agent/ports/settings/model.profile.input.ts';

const main: ModelProfileInput = { id: 'p1', role: 'main', origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet', enabled: true };
const input = (profiles: ModelProfileInput[], localOnly = false): AgentSettingsInput => ({ profiles, localOnly, limits: DEFAULT_RUN_BUDGET });

describe('applySettingsInput', () => {
  it('a chave vai para o cofre e o perfil guarda so a referencia', async () => {
    const secrets = new MemorySecretStore();
    const next = await applySettingsInput('u1', emptyAgentSettings(), input([{ ...main, apiKey: 'sk-or-v1-SEGREDO' }]), secrets);
    const ref = next.profiles[0]?.keyRef as string;
    assert.equal(ref, 'agent.key.u1.p1');
    assert.equal(await secrets.get(ref), 'sk-or-v1-SEGREDO');
    assert.equal(JSON.stringify(next).includes('SEGREDO'), false);
  });

  it('sem apiKey, a chave guardada e mantida', async () => {
    const secrets = new MemorySecretStore();
    const first = await applySettingsInput('u1', emptyAgentSettings(), input([{ ...main, apiKey: 'sk-aaaaaaaaaa' }]), secrets);
    const second = await applySettingsInput('u1', first, input([{ ...main, model: 'anthropic/claude-sonnet' }]), secrets);
    assert.equal(second.profiles[0]?.keyRef, first.profiles[0]?.keyRef);
    assert.equal(await secrets.get(second.profiles[0]?.keyRef as string), 'sk-aaaaaaaaaa');
  });

  it('trocar a chave sobrescreve a mesma referencia', async () => {
    const secrets = new MemorySecretStore();
    const first = await applySettingsInput('u1', emptyAgentSettings(), input([{ ...main, apiKey: 'sk-aaaaaaaaaa' }]), secrets);
    const second = await applySettingsInput('u1', first, input([{ ...main, apiKey: 'sk-bbbbbbbbbb' }]), secrets);
    assert.equal(second.profiles[0]?.keyRef, first.profiles[0]?.keyRef);
    assert.equal(await secrets.get(second.profiles[0]?.keyRef as string), 'sk-bbbbbbbbbb');
    assert.equal(secrets.refs().length, 1);
  });

  it('capacidades verificadas sobrevivem se endereco e modelo nao mudaram; voltam ao conservador se mudaram', async () => {
    const secrets = new MemorySecretStore();
    const verified = { ...CONSERVATIVE_CAPABILITIES, tools: true, verifiedAt: '2026-10-22T12:00:00Z' };
    const first = await applySettingsInput('u1', emptyAgentSettings(), input([{ ...main, capabilities: verified }]), secrets);
    const same = await applySettingsInput('u1', first, input([{ ...main }]), secrets);
    assert.equal(same.profiles[0]?.capabilities.verifiedAt, '2026-10-22T12:00:00Z');
    const other = await applySettingsInput('u1', first, input([{ ...main, model: 'google/gemini-flash' }]), secrets);
    assert.deepEqual(other.profiles[0]?.capabilities, CONSERVATIVE_CAPABILITIES);
    const url = await applySettingsInput('u1', first, input([{ ...main, baseUrl: 'https://outro.exemplo.com/v1' }]), secrets);
    assert.equal(url.profiles[0]?.capabilities.tools, false);
  });

  it('perfil removido apaga a chave do cofre', async () => {
    const secrets = new MemorySecretStore();
    const first = await applySettingsInput('u1', emptyAgentSettings(), input([{ ...main, apiKey: 'sk-aaaaaaaaaa' }, { ...main, id: 'p2', role: 'fast', apiKey: 'sk-bbbbbbbbbb' }]), secrets);
    assert.equal(secrets.refs().length, 2);
    await applySettingsInput('u1', first, input([{ ...main }]), secrets);
    assert.deepEqual(secrets.refs(), ['agent.key.u1.p1']);
  });

  it('perfil local sem chave fica sem keyRef; modo somente-local e limites seguem a entrada', async () => {
    const next = await applySettingsInput('u1', emptyAgentSettings(), { profiles: [{ ...main, id: 'l', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1' }], localOnly: true, limits: { ...DEFAULT_RUN_BUDGET, maxSteps: 5 } }, new MemorySecretStore());
    assert.equal(next.profiles[0]?.keyRef, null);
    assert.equal(next.localOnly, true);
    assert.equal(next.limits.maxSteps, 5);
  });
});

describe('MemoryAgentSettings', () => {
  it('guarda por usuario, isolado, e le uma copia', async () => {
    const settings = new MemoryAgentSettings(new MemorySecretStore());
    await settings.write('u1', input([main]));
    assert.equal((await settings.read('u1')).profiles.length, 1);
    assert.equal((await settings.read('u2')).profiles.length, 0);
    const read = await settings.read('u1');
    (read as { localOnly: boolean }).localOnly = true;
    assert.equal((await settings.read('u1')).localOnly, false);
  });

  it('consentimento: registrar, ler, revogar, por usuario', async () => {
    const settings = new MemoryAgentSettings(new MemorySecretStore());
    assert.equal(await settings.readConsent('u1'), null);
    await settings.recordConsent('u1', { kind: 'cloud', acceptedAt: '2026-10-22T10:14:00Z', textVersion: 'agent-cloud-v1' });
    assert.equal((await settings.readConsent('u1'))?.textVersion, 'agent-cloud-v1');
    assert.equal(await settings.readConsent('u2'), null);
    await settings.revokeConsent('u1');
    assert.equal(await settings.readConsent('u1'), null);
  });
});
