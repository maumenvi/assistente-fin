import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GetAttachmentUseCase } from '../../../src/app/agent/attachment/manage/get.attachment.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { AttachmentNotFoundError } from '../../../src/domain/agent/attachment/errors/attachment.not.found.error.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';

describe('GetAttachmentUseCase', () => {
  it('devolve os bytes so ao dono; outro usuario, id inexistente e apagado => nao encontrado', async () => {
    const store = new FakeAgentStore();
    await store.attachments.save({ id: 'a1', userId: 'u1', conversationId: 'c1', messageId: 'm1', name: 'nota.jpg', kind: 'image', mediaType: 'image/jpeg', sizeBytes: 3, status: 'ready', extracted: null, bytes: Uint8Array.from([1, 2, 3]), createdAt: '2026-10-24T10:00:00Z' });
    const get = new GetAttachmentUseCase(store.attachments);
    assert.deepEqual(await get.execute({ userId: 'u1', attachmentId: 'a1' }), { name: 'nota.jpg', mediaType: 'image/jpeg', bytes: Uint8Array.from([1, 2, 3]) });
    await assert.rejects(get.execute({ userId: 'u2', attachmentId: 'a1' }), AttachmentNotFoundError);
    await assert.rejects(get.execute({ userId: 'u1', attachmentId: 'zzz' }), AttachmentNotFoundError);
    await store.attachments.delete('u1', 'a1');
    await assert.rejects(get.execute({ userId: 'u1', attachmentId: 'a1' }), AttachmentNotFoundError);
    await assert.rejects(get.execute({ userId: '', attachmentId: 'a1' }), InvalidInputError);
  });
});
