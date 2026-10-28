import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore, DRAFT_TTL_MS, type NewAttachmentDraft } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { AttachmentTooLargeError } from '../../../src/domain/agent/attachment/errors/attachment.too.large.error.ts';
import { DraftNotFoundError } from '../../../src/domain/agent/attachment/errors/draft.not.found.error.ts';
import { MutableClock } from '../../support/mutable.clock.ts';

const draft = (id: string, userId = 'u1', sizeBytes = 1000): NewAttachmentDraft => ({ draftId: id, userId, name: `${id}.csv`, kind: 'csv', mediaType: 'text/csv', sizeBytes, status: 'ready', extracted: null, bytes: new Uint8Array(0), warnings: [] });
const advance = (clock: MutableClock, ms: number): void => clock.set(new Date(clock.now().getTime() + ms));
const setup = () => {
  const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
  return { clock, store: new AttachmentDraftStore(clock) };
};

describe('AttachmentDraftStore', () => {
  it('guarda e le so do dono; outro usuario nao enxerga', () => {
    const { store } = setup();
    store.put(draft('d1'));
    assert.equal(store.get('u1', 'd1').name, 'd1.csv');
    assert.throws(() => store.get('u2', 'd1'), DraftNotFoundError);
    assert.throws(() => store.get('u1', 'nao'), DraftNotFoundError);
  });

  it('expira em 1 hora', () => {
    const { store, clock } = setup();
    store.put(draft('d1'));
    advance(clock, DRAFT_TTL_MS - 1);
    assert.equal(store.get('u1', 'd1').draftId, 'd1');
    advance(clock, 2);
    assert.throws(() => store.get('u1', 'd1'), DraftNotFoundError);
  });

  it('preso a um envio pendente nao expira; ao descartar some', () => {
    const { store, clock } = setup();
    store.put(draft('d1'));
    store.pin('u1', 'd1');
    advance(clock, DRAFT_TTL_MS * 5);
    assert.equal(store.get('u1', 'd1').draftId, 'd1');
    store.discard('u1', 'd1');
    assert.throws(() => store.get('u1', 'd1'), DraftNotFoundError);
  });

  it('recusa o 6o rascunho e o que passa de 20 MB somados; descartar libera', () => {
    const { store } = setup();
    for (let i = 1; i <= 5; i += 1) store.put(draft(`d${i}`));
    assert.throws(() => store.put(draft('d6')), AttachmentTooLargeError);
    store.discard('u1', 'd5');
    store.put(draft('d6'));
    const big = setup().store;
    big.put(draft('a', 'u1', 12 * 1024 * 1024));
    assert.throws(() => big.put(draft('b', 'u1', 9 * 1024 * 1024)), AttachmentTooLargeError);
    big.put(draft('c', 'u2', 9 * 1024 * 1024));
  });

  it('take consome tudo ou nada', () => {
    const { store } = setup();
    store.put(draft('d1'));
    store.put(draft('d2'));
    assert.throws(() => store.take('u1', ['d1', 'nao']), DraftNotFoundError);
    assert.equal(store.listOf('u1').length, 2);
    assert.deepEqual(store.take('u1', ['d1', 'd2']).map((d) => d.draftId), ['d1', 'd2']);
    assert.equal(store.listOf('u1').length, 0);
  });
});
