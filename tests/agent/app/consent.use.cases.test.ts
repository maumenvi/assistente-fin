import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GetConsentStatusUseCase } from '../../../src/app/agent/use-cases/get.consent.status.use.case.ts';
import { RecordConsentUseCase } from '../../../src/app/agent/use-cases/record.consent.use.case.ts';
import { RevokeConsentUseCase } from '../../../src/app/agent/use-cases/revoke.consent.use.case.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { CLOUD_CONSENT_VERSION } from '../../../src/app/agent/settings/cloud.consent.version.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { CLOUD_MAIN, LOCAL_MAIN, makeAgentApp } from './support/agent.app.harness.ts';
import { MutableClock } from '../../support/mutable.clock.ts';

function setup() {
  const settings = new MemoryAgentSettings(new MemorySecretStore());
  const deps = { settings, clock: new MutableClock(new Date('2026-10-22T12:00:00Z')) };
  return { settings, status: new GetConsentStatusUseCase(deps), record: new RecordConsentUseCase(deps), revoke: new RevokeConsentUseCase(deps) };
}

describe('casos de uso de consentimento', () => {
  it('nuvem sem aceite: needed; aceitar registra data e versao; revogar volta a exigir', async () => {
    const t = setup();
    await t.settings.write('u1', { profiles: [CLOUD_MAIN], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, true);
    const accepted = await t.record.execute({ userId: 'u1', textVersion: CLOUD_CONSENT_VERSION });
    assert.equal(accepted.needed, false);
    assert.equal(accepted.record?.acceptedAt, '2026-10-22T12:00:00.000Z');
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, false);
    const revoked = await t.revoke.execute({ userId: 'u1' });
    assert.equal(revoked.needed, true);
    assert.equal(revoked.record, null);
  });

  it('versao antiga do texto e recusada; aceite de versao diferente da vigente nao vale', async () => {
    const t = setup();
    await assert.rejects(t.record.execute({ userId: 'u1', textVersion: 'agent-cloud-v0' }), InvalidInputError);
    await t.settings.write('u1', { profiles: [CLOUD_MAIN], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
    await t.settings.recordConsent('u1', { kind: 'cloud', acceptedAt: 'x', textVersion: 'agent-cloud-v0' });
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, true);
  });

  it('perfil local, somente local ou sem modelo nunca precisam de consentimento; usuarios sao isolados', async () => {
    const t = setup();
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, false);
    await t.settings.write('u1', { profiles: [LOCAL_MAIN], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, false);
    await t.settings.write('u2', { profiles: [CLOUD_MAIN], localOnly: true, limits: { ...DEFAULT_RUN_BUDGET } });
    assert.equal((await t.status.execute({ userId: 'u2' })).needed, false);
    await assert.rejects(t.status.execute({ userId: '' }), InvalidInputError);
  });

  it('sem consentimento nada sai: o envio a nuvem para antes de qualquer rede (espiao de fetch)', async () => {
    const app = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'finish', reason: 'stop' }] }]) });
    await app.configure([CLOUD_MAIN]);
    await assert.rejects(app.send.execute({ userId: 'u1', text: 'quanto gastei?' }), /consentimento/);
    // nenhum modelo foi montado (nem segredo lido, nem requisicao feita) e nada foi gravado
    assert.deepEqual(app.madeProfiles, []);
    assert.deepEqual(await app.store.conversations.list('u1', { limit: 10 }), []);
  });
});
