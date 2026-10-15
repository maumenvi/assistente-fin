import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UuidIdGenerator } from '../../../src/libs/id/uuid.id.generator.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('next gera UUID v4 valido e unico', () => {
  const generator = new UuidIdGenerator();
  const ids = new Set<string>();

  for (let i = 0; i < 1000; i += 1) {
    const id = generator.next();
    assert.match(id, UUID_V4);
    ids.add(id);
  }

  assert.equal(ids.size, 1000);
});
