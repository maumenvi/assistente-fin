import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBadgeCount } from '../../../src/domain/pre-registration/format.badge.count.ts';

test('sino: vazio com zero, numero ate 99, 99+ acima (FR-028)', () => {
  assert.equal(formatBadgeCount(0), '');
  assert.equal(formatBadgeCount(3), '3');
  assert.equal(formatBadgeCount(99), '99');
  assert.equal(formatBadgeCount(100), '99+');
  assert.equal(formatBadgeCount(1234), '99+');
});
