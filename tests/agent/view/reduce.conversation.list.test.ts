import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type ConversationItem } from '../../../src/app/agent/view/conversation.item.ts';
import { emptyConversationList, reduceConversationList } from '../../../src/app/agent/view/reduce.conversation.list.ts';

const item = (id: string, minute: number): ConversationItem => ({ id, title: `Conversa ${id}`, createdAt: '2026-10-22T10:00:00Z', lastMessageAt: `2026-10-22T10:${String(minute).padStart(2, '0')}:00Z` });

describe('reduceConversationList', () => {
  it('primeira pagina ordena pela mais recente; pagina cheia indica que ha mais', () => {
    const page = Array.from({ length: 50 }, (_, i) => item(`c${i}`, i));
    const state = reduceConversationList(emptyConversationList(), { kind: 'page_loaded', items: page, append: false });
    assert.equal(state.loaded, true);
    assert.equal(state.hasMore, true);
    assert.equal(state.items[0]?.id, 'c49');
    const short = reduceConversationList(emptyConversationList(), { kind: 'page_loaded', items: [item('a', 1)], append: false });
    assert.equal(short.hasMore, false);
  });

  it('carregar mais acrescenta sem duplicar', () => {
    let state = reduceConversationList(emptyConversationList(), { kind: 'page_loaded', items: [item('a', 5), item('b', 4)], append: false });
    state = reduceConversationList(state, { kind: 'page_loaded', items: [item('b', 4), item('c', 3)], append: true });
    assert.deepEqual(state.items.map((i) => i.id), ['a', 'b', 'c']);
  });

  it('upsert reordena por recencia; remover e limpar', () => {
    let state = reduceConversationList(emptyConversationList(), { kind: 'page_loaded', items: [item('a', 5), item('b', 4)], append: false });
    state = reduceConversationList(state, { kind: 'upserted', item: { ...item('b', 9), title: 'Novo titulo' } });
    assert.deepEqual(state.items.map((i) => i.id), ['b', 'a']);
    assert.equal(state.items[0]?.title, 'Novo titulo');
    state = reduceConversationList(state, { kind: 'removed', id: 'a' });
    assert.deepEqual(state.items.map((i) => i.id), ['b']);
    state = reduceConversationList(state, { kind: 'cleared' });
    assert.deepEqual(state.items, []);
    assert.equal(state.hasMore, false);
  });
});
