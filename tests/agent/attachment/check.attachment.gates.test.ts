import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ATTACHMENTS_CONSENT_VERSION } from '../../../src/app/agent/attachment/consent/attachments.consent.version.ts';
import { assertAttachmentGates, attachmentBlockers, type AttachmentGateInput } from '../../../src/app/agent/attachment/gate/check.attachment.gates.ts';
import { AttachmentConsentRequiredError } from '../../../src/domain/agent/attachment/errors/attachment.consent.required.error.ts';
import { ContextTooSmallForAttachmentError } from '../../../src/domain/agent/attachment/errors/context.too.small.for.attachment.error.ts';
import { DraftStillReadingError } from '../../../src/domain/agent/attachment/errors/draft.still.reading.error.ts';
import { VisionNotSupportedError } from '../../../src/domain/agent/attachment/errors/vision.not.supported.error.ts';
import { LocalOnlyViolationError } from '../../../src/domain/agent/errors/local.only.violation.error.ts';

const ok: AttachmentGateInput = {
  localOnly: false, cloud: true, vision: true, contextWindow: 128_000,
  consent: { kind: 'attachments', acceptedAt: 'x', textVersion: ATTACHMENTS_CONSENT_VERSION },
  drafts: [{ kind: 'csv', status: 'ready' }],
};

describe('portoes de envio de anexos (contracts/consent.md)', () => {
  it('tudo em ordem: nenhum bloqueio; sem anexos nunca bloqueia', () => {
    assert.deepEqual(attachmentBlockers(ok), []);
    assert.deepEqual(attachmentBlockers({ ...ok, drafts: [], consent: null, vision: false }), []);
  });

  it('nuvem sem consentimento de anexos (ou de outra versao) bloqueia; modelo local nao pede consentimento', () => {
    assert.deepEqual(attachmentBlockers({ ...ok, consent: null }), ['consent']);
    assert.deepEqual(attachmentBlockers({ ...ok, consent: { kind: 'attachments', acceptedAt: 'x', textVersion: 'agent-attachments-v0' } }), ['consent']);
    assert.deepEqual(attachmentBlockers({ ...ok, cloud: false, consent: null }), []);
    assert.throws(() => assertAttachmentGates({ ...ok, consent: null }), AttachmentConsentRequiredError);
  });

  it('"somente local" com modelo de nuvem bloqueia primeiro e nao pede consentimento', () => {
    const input = { ...ok, localOnly: true, consent: null };
    assert.deepEqual(attachmentBlockers(input), ['local_only']);
    assert.throws(() => assertAttachmentGates(input), LocalOnlyViolationError);
  });

  it('imagem sem visao bloqueia, mesmo em modelo local; arquivo de texto nao precisa de visao', () => {
    const image = { ...ok, cloud: false, vision: false, drafts: [{ kind: 'image' as const, status: 'ready' as const }] };
    assert.deepEqual(attachmentBlockers(image), ['vision']);
    assert.throws(() => assertAttachmentGates(image), VisionNotSupportedError);
    assert.deepEqual(attachmentBlockers({ ...ok, vision: false }), []);
  });

  it('rascunho ainda lendo e janela sem espaco bloqueiam, na ordem do contrato', () => {
    assert.throws(() => assertAttachmentGates({ ...ok, drafts: [{ kind: 'pdf', status: 'reading' }] }), DraftStillReadingError);
    assert.throws(() => assertAttachmentGates({ ...ok, contextWindow: 4096 }), ContextTooSmallForAttachmentError);
    assert.deepEqual(attachmentBlockers({ ...ok, consent: null, vision: false, drafts: [{ kind: 'image', status: 'reading' }], contextWindow: 4096 }), ['vision', 'consent', 'reading', 'context_too_small']);
  });
});
