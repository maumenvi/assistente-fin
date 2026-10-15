import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfigSchema } from '../../../src/app/shared/database.config.schema.ts';

test('aceita driver fake sem url', () => {
  const result = databaseConfigSchema.safeParse({ driver: 'fake' });
  assert.equal(result.success, true);
});

test('aceita driver prisma com url', () => {
  const result = databaseConfigSchema.safeParse({
    driver: 'prisma',
    url: 'postgresql://localhost/db',
  });
  assert.equal(result.success, true);
});

test('rejeita driver prisma sem url (RF-21)', () => {
  const result = databaseConfigSchema.safeParse({ driver: 'prisma' });
  assert.equal(result.success, false);
  if (!result.success) {
    const flat = result.error.flatten();
    assert.ok(flat.fieldErrors['url']);
  }
});

test('rejeita driver desconhecido', () => {
  const result = databaseConfigSchema.safeParse({ driver: 'mongo' });
  assert.equal(result.success, false);
});
