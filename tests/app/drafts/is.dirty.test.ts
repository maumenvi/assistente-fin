import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDirty } from '../../../src/app/drafts/is.dirty.ts';

const initial = { mode: 'expense', amount: '', date: '30/09/2026', accountId: undefined, installments: '2', tags: ['a'], nested: { x: 1 } };

test('igual ao inicial -> sem alteracao (spec 024, FR-016)', () => {
  assert.equal(isDirty(initial, { ...initial, tags: ['a'], nested: { x: 1 } }), false);
});

test('campo alterado -> com alteracao', () => {
  assert.equal(isDirty(initial, { ...initial, amount: '12,50' }), true);
  assert.equal(isDirty(initial, { ...initial, accountId: 'itau' }), true);
  assert.equal(isDirty(initial, { ...initial, tags: ['a', 'b'] }), true);
  assert.equal(isDirty(initial, { ...initial, nested: { x: 2 } }), true);
});

test('alterado e depois desfeito -> sem alteracao', () => {
  const edited = { ...initial, amount: '12,50' };
  assert.equal(isDirty(initial, { ...edited, amount: '' }), false);
});

test('campo ausente e undefined sao iguais; null e undefined nao', () => {
  const { accountId: _ignored, ...withoutAccount } = initial;
  assert.equal(isDirty(initial, withoutAccount), false);
  assert.equal(isDirty({ a: null }, { a: undefined }), true);
});

test('tipos diferentes e nulos', () => {
  assert.equal(isDirty(null, null), false);
  assert.equal(isDirty({ a: 1 }, null), true);
  assert.equal(isDirty([1], { 0: 1 }), true);
  assert.equal(isDirty('1', 1), true);
});
