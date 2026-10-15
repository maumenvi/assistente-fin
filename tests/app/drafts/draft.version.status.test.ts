import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftVersionStatus } from '../../../src/app/drafts/draft.version.status.ts';

test('registro excluido, alterado ou igual desde o inicio da edicao (spec 024, FR-022)', () => {
  assert.equal(draftVersionStatus('v1', null), 'deleted');
  assert.equal(draftVersionStatus('v1', { updatedAt: 'v2' }), 'changed');
  assert.equal(draftVersionStatus('v1', { updatedAt: 'v1' }), 'same');
  assert.equal(draftVersionStatus(null, { updatedAt: null }), 'same');
  assert.equal(draftVersionStatus(null, { updatedAt: 'v1' }), 'changed');
});
