import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ATTACHMENTS_CONSENT_VERSION } from '../../../src/app/agent/attachment/consent/attachments.consent.version.ts';
import { CLOUD_CONSENT_VERSION } from '../../../src/app/agent/settings/cloud.consent.version.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { GetConsentStatusUseCase } from '../../../src/app/agent/use-cases/get.consent.status.use.case.ts';
import { RecordConsentUseCase } from '../../../src/app/agent/use-cases/record.consent.use.case.ts';
import { RevokeConsentUseCase } from '../../../src/app/agent/use-cases/revoke.consent.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { CLOUD_MAIN } from '../app/support/agent.app.harness.ts';

function setup() {
  const settings = new MemoryAgentSettings(new MemorySecretStore());
  const deps = { settings, clock: new MutableClock(new Date('2026-10-24T12:00:00Z')) };
  return { settings, status: new GetConsentStatusUseCase(deps), record: new RecordConsentUseCase(deps), revoke: new RevokeConsentUseCase(deps) };
}

describe('consentimento por tipo (spec 036)', () => {
  it('aceitar nuvem nao aceita anexos; cada tipo tem a sua versao e a sua revogacao', async () => {
    const t = setup();
    await t.settings.write('u1', { profiles: [CLOUD_MAIN], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } });
    await t.record.execute({ userId: 'u1', textVersion: CLOUD_CONSENT_VERSION });
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, false);
    const att = await t.status.execute({ userId: 'u1', kind: 'attachments' });
    assert.equal(att.needed, true);
    assert.equal(att.textVersion, ATTACHMENTS_CONSENT_VERSION);
    const accepted = await t.record.execute({ userId: 'u1', kind: 'attachments', textVersion: ATTACHMENTS_CONSENT_VERSION });
    assert.equal(accepted.needed, false);
    assert.equal(accepted.record?.kind, 'attachments');
    await t.revoke.execute({ userId: 'u1', kind: 'attachments' });
    assert.equal((await t.status.execute({ userId: 'u1', kind: 'attachments' })).needed, true);
    assert.equal((await t.status.execute({ userId: 'u1' })).needed, false, 'revogar anexos nao revoga a nuvem');
  });

  it('o texto de um tipo nao vale para o outro', async () => {
    const t = setup();
    await assert.rejects(t.record.execute({ userId: 'u1', kind: 'attachments', textVersion: CLOUD_CONSENT_VERSION }), InvalidInputError);
    await assert.rejects(t.record.execute({ userId: 'u1', kind: 'cloud', textVersion: ATTACHMENTS_CONSENT_VERSION }), InvalidInputError);
  });
});
