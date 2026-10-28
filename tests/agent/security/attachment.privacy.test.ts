import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ATTACHMENTS_CONSENT_VERSION } from '../../../src/app/agent/attachment/consent/attachments.consent.version.ts';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { CheckAttachmentsUseCase } from '../../../src/app/agent/attachment/gate/check.attachments.use.case.ts';
import { CLOUD_CONSENT_VERSION } from '../../../src/app/agent/settings/cloud.consent.version.ts';
import { SendMessageUseCase } from '../../../src/app/agent/use-cases/send.message.use.case.ts';
import { AttachmentConsentRequiredError } from '../../../src/domain/agent/attachment/errors/attachment.consent.required.error.ts';
import { LocalOnlyViolationError } from '../../../src/domain/agent/errors/local.only.violation.error.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { sampleCsv } from '../../support/attachments/build.attachment.fixtures.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { CLOUD_MAIN, LOCAL_MAIN, makeAgentApp } from '../app/support/agent.app.harness.ts';

const answer = { events: [{ type: 'text_delta' as const, text: 'ok' }, { type: 'finish' as const, reason: 'stop' as const }] };

async function setup(profile: typeof CLOUD_MAIN, extra: { localOnly?: boolean } = {}) {
  const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer, answer]);
  const app = makeAgentApp({ llm });
  await app.configure([profile], extra);
  await app.settings.recordConsent('u1', { kind: 'cloud', acceptedAt: 'x', textVersion: CLOUD_CONSENT_VERSION });
  const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
  const drafts = new AttachmentDraftStore(clock);
  const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), ids: new SequentialIdGenerator('d'), clock });
  const send = new SendMessageUseCase({ ...app.deps, drafts });
  const check = new CheckAttachmentsUseCase({ settings: app.settings, drafts, makeLlm: app.deps.makeLlm });
  const draft = await prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
  return { llm, app, send, check, draft, drafts, prepare, clock };
}

describe('privacidade dos anexos (spec 036, US3)', () => {
  it('nuvem sem consentimento de anexos: o envio e recusado antes de qualquer requisicao e o rascunho fica; aceitar libera; revogar volta a pedir', async () => {
    const t = await setup(CLOUD_MAIN);
    assert.equal((await t.check.execute({ userId: 'u1', draftIds: [t.draft.draftId] })).needsConsent, true);
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'quanto gastei no total?', attachmentIds: [t.draft.draftId] }), AttachmentConsentRequiredError);
    assert.equal(t.llm.requests.length, 0, 'nenhuma requisicao ao modelo');
    assert.equal((await t.app.store.conversations.list('u1', { limit: 5 })).length, 0, 'nenhuma conversa criada');
    assert.equal(t.drafts.get('u1', t.draft.draftId).name, 'extrato.csv', 'o rascunho continua para reenviar');

    await t.app.settings.recordConsent('u1', { kind: 'attachments', acceptedAt: 'x', textVersion: ATTACHMENTS_CONSENT_VERSION });
    assert.equal((await t.check.execute({ userId: 'u1', draftIds: [t.draft.draftId] })).needsConsent, false);
    const { runId } = await t.send.execute({ userId: 'u1', text: 'quanto gastei no total?', attachmentIds: [t.draft.draftId] });
    await t.app.runs.settled(runId);
    assert.equal(t.llm.requests.length, 1);

    const again = await t.prepare.execute({ userId: 'u1', name: 'outro.csv', bytes: sampleCsv() });
    await t.app.settings.revokeConsent('u1', 'attachments');
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'e agora?', attachmentIds: [again.draftId] }), AttachmentConsentRequiredError);
    assert.equal(t.llm.requests.length, 1, 'revogado: nada novo sai');
  });

  it('o consentimento de nuvem sozinho nao libera os anexos', async () => {
    const t = await setup(CLOUD_MAIN);
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'quanto gastei no total?', attachmentIds: [t.draft.draftId] }), AttachmentConsentRequiredError);
    assert.equal(t.llm.requests.length, 0);
  });

  it('"somente local" com modelo de nuvem: bloqueio, nenhuma requisicao; a pre-checagem avisa', async () => {
    const t = await setup(CLOUD_MAIN, { localOnly: true });
    assert.deepEqual((await t.check.execute({ userId: 'u1', draftIds: [t.draft.draftId] })).blockers, ['local_only']);
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'quanto gastei no total?', attachmentIds: [t.draft.draftId] }), LocalOnlyViolationError);
    assert.equal(t.llm.requests.length, 0);
  });

  it('modelo local (Ollama) nao pede consentimento de anexos', async () => {
    const t = await setup(LOCAL_MAIN);
    assert.deepEqual(await t.check.execute({ userId: 'u1', draftIds: [t.draft.draftId] }), { blockers: [], needsConsent: false, cloud: false });
    const { runId } = await t.send.execute({ userId: 'u1', text: 'quanto gastei no total?', attachmentIds: [t.draft.draftId] });
    await t.app.runs.settled(runId);
    assert.equal(t.llm.requests.length, 1);
  });

  it('pre-checagem com hold (sem conexao) prende o rascunho: ele sobrevive ao TTL', async () => {
    const t = await setup(LOCAL_MAIN);
    await t.check.execute({ userId: 'u1', draftIds: [t.draft.draftId], hold: true });
    t.clock.set(new Date('2026-10-24T13:00:00Z'));
    assert.equal(t.drafts.get('u1', t.draft.draftId).name, 'extrato.csv');
  });
});
