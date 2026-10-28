import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Attachment } from '../../../src/domain/agent/attachment/attachment.ts';
import { type AgentStorePort } from '../../../src/app/agent/ports/store/agent.store.port.ts';
import { makeConversation } from '../store/support/agent.fixtures.ts';

interface Handle {
  readonly store: AgentStorePort;
  ensureUser(userId: string): Promise<void>;
  close(): Promise<void>;
}

function makeAttachment(id: string, userId: string, conversationId: string, overrides: Partial<Attachment> = {}): Attachment {
  return {
    id, userId, conversationId, messageId: 'm1', name: `${id}.csv`, kind: 'csv', mediaType: 'text/csv', sizeBytes: 4, status: 'ready',
    extracted: { kind: 'csv', text: null, sheets: [], warnings: [], stats: { rows: 0, chars: 0 } },
    bytes: Uint8Array.from([1, 2, 3, 4]), createdAt: '2026-10-24T10:00:00.000Z', ...overrides,
  };
}

/** Contrato do `AttachmentStorePort` (spec 036): isolamento por usuario, cascata, apagar e totais; igual em fake, sqlite e prisma. */
export function runAttachmentStoreContract(label: string, factory: () => Promise<Handle>): void {
  async function withStore(body: (s: AgentStorePort) => Promise<void>): Promise<void> {
    const handle = await factory();
    try {
      await handle.ensureUser('u1');
      await handle.ensureUser('u2');
      await handle.store.conversations.create(makeConversation('c1', 'u1'));
      await handle.store.conversations.create(makeConversation('c2', 'u1'));
      await handle.store.conversations.create(makeConversation('c3', 'u2'));
      await body(handle.store);
    } finally {
      await handle.close();
    }
  }

  describe(`contrato do AttachmentStorePort: ${label}`, () => {
    it('grava e le com os bytes e o conteudo extraido; outro usuario nao enxerga', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1'));
        const got = await s.attachments.get('u1', 'a1');
        assert.deepEqual(got, makeAttachment('a1', 'u1', 'c1'));
        assert.deepEqual([...(got?.bytes ?? [])], [1, 2, 3, 4]);
        assert.equal(await s.attachments.get('u2', 'a1'), null);
      }));

    it('imagem: sem conteudo extraido', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('i1', 'u1', 'c1', { kind: 'image', mediaType: 'image/jpeg', extracted: null }));
        assert.equal((await s.attachments.get('u1', 'i1'))?.extracted, null);
      }));

    it('lista por mensagem e por conversa, so do dono', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1', { messageId: 'm1' }));
        await s.attachments.save(makeAttachment('a2', 'u1', 'c1', { messageId: 'm2', createdAt: '2026-10-24T10:01:00.000Z' }));
        await s.attachments.save(makeAttachment('a3', 'u1', 'c2', { messageId: 'm3' }));
        await s.attachments.save(makeAttachment('x1', 'u2', 'c3', { messageId: 'm1' }));
        assert.deepEqual((await s.attachments.listByMessage('u1', 'm1')).map((a) => a.id), ['a1']);
        assert.deepEqual((await s.attachments.listByConversation('u1', 'c1')).map((a) => a.id), ['a1', 'a2']);
        assert.deepEqual(await s.attachments.listByConversation('u2', 'c1'), []);
      }));

    it('apagar um, por conversa e todos; so do dono; devolve quantos', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1'));
        await s.attachments.save(makeAttachment('a2', 'u1', 'c1'));
        await s.attachments.save(makeAttachment('a3', 'u1', 'c2'));
        await s.attachments.save(makeAttachment('x1', 'u2', 'c3'));
        assert.equal(await s.attachments.delete('u2', 'a1'), false);
        assert.equal(await s.attachments.delete('u1', 'a1'), true);
        assert.equal(await s.attachments.delete('u1', 'a1'), false);
        assert.equal(await s.attachments.deleteByConversation('u1', 'c1'), 1);
        assert.equal(await s.attachments.deleteAll('u1'), 1);
        assert.equal((await s.attachments.get('u2', 'x1'))?.id, 'x1');
      }));

    it('apagar a conversa apaga os anexos dela (cascata)', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1'));
        await s.attachments.save(makeAttachment('a3', 'u1', 'c2'));
        await s.conversations.delete('u1', 'c1');
        assert.equal(await s.attachments.get('u1', 'a1'), null);
        assert.equal((await s.attachments.get('u1', 'a3'))?.id, 'a3');
      }));

    it('totais do usuario (quantidade e bytes)', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1', { sizeBytes: 100 }));
        await s.attachments.save(makeAttachment('a2', 'u1', 'c2', { sizeBytes: 250 }));
        await s.attachments.save(makeAttachment('x1', 'u2', 'c3', { sizeBytes: 999 }));
        assert.deepEqual(await s.attachments.stats('u1'), { count: 2, totalBytes: 350 });
        assert.deepEqual(await s.attachments.stats('u2'), { count: 1, totalBytes: 999 });
        assert.deepEqual(await s.attachments.stats('nada'), { count: 0, totalBytes: 0 });
      }));

    it('salvar de novo o mesmo id substitui', () =>
      withStore(async (s) => {
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1', { name: 'antigo.csv' }));
        await s.attachments.save(makeAttachment('a1', 'u1', 'c1', { name: 'novo.csv' }));
        assert.equal((await s.attachments.get('u1', 'a1'))?.name, 'novo.csv');
        assert.equal((await s.attachments.stats('u1')).count, 1);
      }));
  });
}
