import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLlmPort } from '../../../src/app/agent/llm/create.llm.port.ts';
import { type CreateLlmPortDeps } from '../../../src/app/agent/llm/create.llm.port.deps.ts';
import { pickRoleLlm } from '../../../src/app/agent/llm/pick.role.llm.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { CLOUD_CONSENT_VERSION } from '../../../src/app/agent/settings/cloud.consent.version.ts';
import { ConsentRequiredError } from '../../../src/domain/agent/errors/consent.required.error.ts';
import { LocalOnlyViolationError } from '../../../src/domain/agent/errors/local.only.violation.error.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { type ModelProfile } from '../../../src/domain/agent/model.profile.ts';

const cloud: ModelProfile = {
  id: 'main',
  role: 'main',
  origin: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4',
  keyRef: 'agent.key.u1.main',
  capabilities: CONSERVATIVE_CAPABILITIES,
  enabled: true,
};
const local: ModelProfile = {
  ...cloud,
  id: 'loc',
  origin: 'openai_compat_local',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3',
  keyRef: null,
};

async function setup(over: Partial<CreateLlmPortDeps> = {}): Promise<{ deps: CreateLlmPortDeps; calls: string[] }> {
  const calls: string[] = [];
  const secrets = new MemorySecretStore();
  await secrets.set('agent.key.u1.main', 'sk-x');
  const deps: CreateLlmPortDeps = {
    secrets,
    fetchFn: (url) => {
      calls.push(url);
      return Promise.reject(new Error('rede nao deveria ser usada'));
    },
    localOnly: false,
    consent: { kind: 'cloud', acceptedAt: '2026-10-22T00:00:00Z', textVersion: CLOUD_CONSENT_VERSION },
    consentTextVersion: CLOUD_CONSENT_VERSION,
    ...over,
  };
  return { deps, calls };
}

describe('createLlmPort', () => {
  it('somente local + perfil de nuvem lanca LocalOnlyViolationError sem rede', async () => {
    const { deps, calls } = await setup({ localOnly: true });
    await assert.rejects(createLlmPort(cloud, deps), LocalOnlyViolationError);
    assert.equal(calls.length, 0);
  });

  it('nuvem sem consentimento (ou de outra versao) lanca ConsentRequiredError sem rede', async () => {
    for (const consent of [null, { kind: 'cloud' as const, acceptedAt: 'x', textVersion: 'agent-cloud-v0' }]) {
      const { deps, calls } = await setup({ consent });
      await assert.rejects(createLlmPort(cloud, deps), ConsentRequiredError);
      assert.equal(calls.length, 0);
    }
  });

  it('perfil local nunca exige consentimento e funciona com somente local', async () => {
    const { deps, calls } = await setup({ consent: null, localOnly: true });
    const port = await createLlmPort(local, deps);
    assert.ok(port);
    assert.equal(calls.length, 0);
  });

  it('nuvem com consentimento monta a porta usando presets quando nao verificado', async () => {
    const { deps } = await setup();
    const port = await createLlmPort(cloud, deps);
    assert.equal(port.capabilities.tools, true);
  });
});

describe('pickRoleLlm', () => {
  it('fast sem perfil rapido devolve o principal e informa quem respondeu', async () => {
    const { deps } = await setup();
    const main = await createLlmPort(cloud, deps);
    const fast = await createLlmPort(local, deps);
    assert.deepEqual(
      { same: pickRoleLlm({ main }, 'fast').llm === main, by: pickRoleLlm({ main }, 'fast').answeredBy },
      { same: true, by: 'main' },
    );
    assert.equal(pickRoleLlm({ main, fast }, 'fast').llm, fast);
    assert.equal(pickRoleLlm({ main, fast }, 'fast').answeredBy, 'fast');
    assert.equal(pickRoleLlm({ main, fast }, 'main').llm, main);
  });
});
