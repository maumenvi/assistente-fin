import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type CaptureAttachmentRepository } from '../../../src/app/pre-registration/capture.attachment.repository.port.ts';
import { CaptureAttachment } from '../../../src/domain/pre-registration/capture.attachment.entity.ts';

const att = (id: string, preId: string, userId = 'u1') =>
  CaptureAttachment.create({
    id,
    userId,
    preRegistrationId: preId,
    kind: 'speech-text',
    content: `texto ${id}`,
    sha256: id.padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, 'a'),
    createdAt: new Date('2026-09-24T10:00:00Z'),
  });

/** Suite de contrato do `CaptureAttachmentRepository` (spec 022, T047). */
export function runCaptureAttachmentRepositoryContract(label: string, createRepository: () => CaptureAttachmentRepository): void {
  test(`${label}: lista por pre-registro e remove todos juntos`, async () => {
    const repo = createRepository();
    await repo.save(att('a1', 'p1'));
    await repo.save(att('a2', 'p1'));
    await repo.save(att('a3', 'p2'));
    assert.equal((await repo.listByPreRegistration('u1', 'p1')).length, 2);
    assert.equal((await repo.listByPreRegistration('u2', 'p1')).length, 0);
    await repo.deleteByPreRegistration('u1', 'p1');
    assert.equal((await repo.listByPreRegistration('u1', 'p1')).length, 0);
    assert.equal((await repo.listByPreRegistration('u1', 'p2')).length, 1);
  });

  test(`${label}: findById e delete no escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(att('a9', 'p9'));
    assert.equal((await repo.findById('u1', 'a9'))?.content, 'texto a9');
    assert.equal(await repo.findById('u2', 'a9'), null);
    await repo.delete('u2', 'a9');
    assert.ok(await repo.findById('u1', 'a9'));
    await repo.delete('u1', 'a9');
    assert.equal(await repo.findById('u1', 'a9'), null);
  });
}
