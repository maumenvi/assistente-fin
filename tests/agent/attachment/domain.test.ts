import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ATTACHMENT_KINDS } from '../../../src/domain/agent/attachment/attachment.kind.ts';
import { ATTACHMENT_LIMITS } from '../../../src/domain/agent/attachment/attachment.limits.ts';
import { AttachmentTooLargeError } from '../../../src/domain/agent/attachment/errors/attachment.too.large.error.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { AGENT_ERROR_MESSAGES } from '../../../src/app/agent/errors/agent.error.messages.ts';
import { AttachmentConsentRequiredError } from '../../../src/domain/agent/attachment/errors/attachment.consent.required.error.ts';
import { ContextTooSmallForAttachmentError } from '../../../src/domain/agent/attachment/errors/context.too.small.for.attachment.error.ts';
import { DraftNotFoundError } from '../../../src/domain/agent/attachment/errors/draft.not.found.error.ts';
import { DraftStillReadingError } from '../../../src/domain/agent/attachment/errors/draft.still.reading.error.ts';
import { StorageFullError } from '../../../src/domain/agent/attachment/errors/storage.full.error.ts';
import { UnsupportedAttachmentError } from '../../../src/domain/agent/attachment/errors/unsupported.attachment.error.ts';
import { VisionNotSupportedError } from '../../../src/domain/agent/attachment/errors/vision.not.supported.error.ts';

describe('dominio dos anexos', () => {
  it('tipos e limites do contrato', () => {
    assert.deepEqual([...ATTACHMENT_KINDS], ['image', 'text', 'csv', 'xlsx', 'pdf']);
    assert.equal(ATTACHMENT_LIMITS.maxFileBytes, 10 * 1024 * 1024);
    assert.equal(ATTACHMENT_LIMITS.maxPerMessage, 5);
    assert.equal(ATTACHMENT_LIMITS.maxMessageBytes, 20 * 1024 * 1024);
    assert.equal(ATTACHMENT_LIMITS.maxRowsPerSheet, 5000);
    assert.equal(ATTACHMENT_LIMITS.maxSheets, 20);
    assert.equal(ATTACHMENT_LIMITS.maxImageSidePx, 2000);
  });

  it('todo erro tem codigo estavel e mensagem em portugues', () => {
    const errors = [
      new UnsupportedAttachmentError(), new AttachmentTooLargeError('file'), new AttachmentTooLargeError('message'),
      new AttachmentUnreadableError('corrupt'), new AttachmentUnreadableError('empty'), new AttachmentUnreadableError('password'), new AttachmentUnreadableError('no_text'), new AttachmentUnreadableError('device'),
      new AttachmentConsentRequiredError(), new VisionNotSupportedError(), new DraftNotFoundError(), new DraftStillReadingError(), new StorageFullError(), new ContextTooSmallForAttachmentError(),
    ];
    assert.equal(new Set(errors.map((e) => e.code)).size, errors.length);
    for (const e of errors) assert.ok((AGENT_ERROR_MESSAGES[e.code] ?? '').length > 10, e.code);
    assert.equal(new AttachmentUnreadableError('password').reason, 'password');
    assert.equal(new AttachmentTooLargeError('file').scope, 'file');
  });
});
