import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDraftRestore } from '../../../src/app/drafts/resolve.draft.restore.ts';
import { type FormDraft } from '../../../src/app/drafts/form.draft.ts';

const parseAmount = (values: unknown) =>
  typeof values === 'object' && values !== null && typeof (values as { amount?: unknown }).amount === 'string' ? (values as { amount: string }) : null;

const draft = (values: unknown): FormDraft => ({ key: 'transaction:novo', form: 'transaction', recordId: null, recordVersion: null, values, updatedAt: new Date('2026-09-30T10:00:00.000Z') });

test('sem rascunho -> none (spec 024)', () => {
  assert.deepEqual(resolveDraftRestore(null, parseAmount), { kind: 'none' });
});

test('valores que o formulario nao reconhece -> invalid (apagar sem quebrar a tela)', () => {
  assert.deepEqual(resolveDraftRestore(draft({ valor: 3 }), parseAmount), { kind: 'invalid' });
});

test('valores validos -> restore com a hora do preenchimento', () => {
  const result = resolveDraftRestore(draft({ amount: '12,5' }), parseAmount);
  assert.equal(result.kind, 'restore');
  if (result.kind === 'restore') {
    assert.deepEqual(result.values, { amount: '12,5' });
    assert.equal(result.updatedAt.toISOString(), '2026-09-30T10:00:00.000Z');
  }
});
