import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptureAttachment } from '../../../src/domain/pre-registration/capture.attachment.entity.ts';
import { InvalidPreRegistrationError } from '../../../src/domain/pre-registration/invalid.pre.registration.error.ts';

const SHA = 'a'.repeat(64);
const base = { id: 'x1', userId: 'u1', preRegistrationId: 'p1', sha256: SHA, createdAt: new Date() };

test('imagem exige mimeType e arquivo; texto exige conteudo', () => {
  assert.equal(CaptureAttachment.create({ ...base, kind: 'image', mimeType: 'image/jpeg', fileRef: 'a.jpg' }).kind, 'image');
  assert.equal(CaptureAttachment.create({ ...base, kind: 'speech-text', content: 'comprei queijo' }).content, 'comprei queijo');
  assert.throws(() => CaptureAttachment.create({ ...base, kind: 'image', fileRef: 'a.jpg' }), InvalidPreRegistrationError);
  assert.throws(() => CaptureAttachment.create({ ...base, kind: 'ocr-text' }), InvalidPreRegistrationError);
  assert.throws(
    () => CaptureAttachment.create({ ...base, kind: 'ocr-text', content: 'x', mimeType: 'text/plain' }),
    InvalidPreRegistrationError,
  );
});

test('sha256 obrigatorio e em hexadecimal', () => {
  assert.throws(
    () => CaptureAttachment.create({ ...base, sha256: 'xyz', kind: 'speech-text', content: 'x' }),
    InvalidPreRegistrationError,
  );
});
