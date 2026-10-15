import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formDraftKey } from '../../../src/app/drafts/form.draft.key.ts';

test('chave do rascunho: formulario + registro, ou "novo" (spec 024)', () => {
  assert.equal(formDraftKey('transaction', null), 'transaction:novo');
  assert.equal(formDraftKey('account', 'acc-1'), 'account:acc-1');
});
