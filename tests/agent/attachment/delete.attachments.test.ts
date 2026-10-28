import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeleteAllAttachmentsUseCase, DeleteAttachmentUseCase, DeleteConversationAttachmentsUseCase } from '../../../src/app/agent/attachment/manage/delete.attachment.use.case.ts';
import { DeleteAllConversationsUseCase } from '../../../src/app/agent/use-cases/delete.all.conversations.use.case.ts';
import { DeleteConversationUseCase } from '../../../src/app/agent/use-cases/delete.conversation.use.case.ts';
import { ActiveRuns } from '../../../src/app/agent/runs/active.runs.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';

const NOW = '2026-10-24T10:00:00Z';

async function seed(store: FakeAgentStore, userId: string, conversationId: string, ids: readonly string[]) {
  await store.conversations.create({ id: conversationId, userId, title: 't', status: 'active', createdAt: NOW, updatedAt: NOW, lastMessageAt: NOW });
  const message = await store.messages.append({
    id: `m-${conversationId}`, conversationId, userId, role: 'user', status: 'complete', runId: null, errorCode: null, createdAt: NOW,
    parts: [{ type: 'text', text: 'oi' }, ...ids.map((id) => ({ type: 'attachment' as const, attachmentId: id, name: `${id}.csv`, kind: 'csv' as const, sizeBytes: 3, available: true }))],
  });
  for (const id of ids) await store.attachments.save({ id, userId, conversationId, messageId: message.id, name: `${id}.csv`, kind: 'csv', mediaType: 'text/csv', sizeBytes: 3, status: 'ready', extracted: null, bytes: Uint8Array.from([1, 2, 3]), createdAt: NOW });
}

const availability = async (store: FakeAgentStore, userId: string, conversationId: string): Promise<boolean[]> =>
  (await store.messages.list(userId, conversationId, { limit: 10 })).flatMap((m) => m.parts.flatMap((p) => (p.type === 'attachment' ? [p.available] : [])));

describe('apagar anexos (US6)', () => {
  it('apagar um: some do disco e a parte vira "apagado"; os outros ficam; outro usuario nada sofre', async () => {
    const store = new FakeAgentStore();
    await seed(store, 'u1', 'c1', ['a1', 'a2']);
    await seed(store, 'u2', 'c2', ['b1']);
    await new DeleteAttachmentUseCase(store).execute({ userId: 'u2', attachmentId: 'a1' });
    assert.equal(await store.attachments.get('u1', 'a1').then((a) => a !== null), true, 'outro usuario nao apaga');
    await new DeleteAttachmentUseCase(store).execute({ userId: 'u1', attachmentId: 'a1' });
    assert.equal(await store.attachments.get('u1', 'a1'), null);
    assert.deepEqual(await availability(store, 'u1', 'c1'), [false, true]);
    assert.deepEqual(await availability(store, 'u2', 'c2'), [true]);
    await new DeleteAttachmentUseCase(store).execute({ userId: 'u1', attachmentId: 'a1' }); // idempotente
  });

  it('apagar os anexos de uma conversa: contagem, partes apagadas, mensagens preservadas', async () => {
    const store = new FakeAgentStore();
    await seed(store, 'u1', 'c1', ['a1', 'a2']);
    await seed(store, 'u1', 'c3', ['a3']);
    const out = await new DeleteConversationAttachmentsUseCase(store).execute({ userId: 'u1', conversationId: 'c1' });
    assert.equal(out.removed, 2);
    assert.deepEqual(await availability(store, 'u1', 'c1'), [false, false]);
    assert.equal((await store.messages.list('u1', 'c1', { limit: 5 })).length, 1);
    assert.deepEqual(await availability(store, 'u1', 'c3'), [true]);
  });

  it('apagar todos: so os do usuario; estatistica zera', async () => {
    const store = new FakeAgentStore();
    await seed(store, 'u1', 'c1', ['a1']);
    await seed(store, 'u1', 'c3', ['a3']);
    await seed(store, 'u2', 'c2', ['b1']);
    assert.equal((await store.attachments.stats('u1')).count, 2);
    const out = await new DeleteAllAttachmentsUseCase(store).execute({ userId: 'u1' });
    assert.equal(out.removed, 2);
    assert.deepEqual(await store.attachments.stats('u1'), { count: 0, totalBytes: 0 });
    assert.equal((await store.attachments.stats('u2')).count, 1);
    assert.deepEqual(await availability(store, 'u1', 'c3'), [false]);
  });

  it('apagar a conversa (ou todo o historico) apaga os anexos juntos', async () => {
    const store = new FakeAgentStore();
    await seed(store, 'u1', 'c1', ['a1']);
    await seed(store, 'u1', 'c3', ['a3']);
    await seed(store, 'u2', 'c2', ['b1']);
    await new DeleteConversationUseCase(store, new ActiveRuns()).execute({ userId: 'u1', conversationId: 'c1' });
    assert.equal(await store.attachments.get('u1', 'a1'), null);
    assert.ok(await store.attachments.get('u1', 'a3'));
    await new DeleteAllConversationsUseCase(store, new ActiveRuns()).execute({ userId: 'u1' });
    assert.equal((await store.attachments.stats('u1')).count, 0);
    assert.equal((await store.attachments.stats('u2')).count, 1);
  });
});
