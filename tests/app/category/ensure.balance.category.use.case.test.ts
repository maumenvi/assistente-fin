import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureBalanceCategory } from '../../../src/app/category/ensure.balance.category.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => ({ categories: new FakeCategoryRepository(), ids: new SequentialIdGenerator('cat') });

test('cria a categoria de sistema "SALDO" quando o usuario nao tem nenhuma (spec 011, RF-16)', async () => {
  const { categories, ids } = setup();

  const created = await ensureBalanceCategory(categories, ids, 'u1');

  assert.equal(created.name.value, 'SALDO');
  assert.equal(created.isSystemBalance, true);
  assert.equal(created.userId, 'u1');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('e idempotente: a segunda chamada devolve a mesma categoria, sem duplicar', async () => {
  const { categories, ids } = setup();

  const first = await ensureBalanceCategory(categories, ids, 'u1');
  const second = await ensureBalanceCategory(categories, ids, 'u1');

  assert.equal(second.id, first.id);
  assert.equal((await categories.listByUser('u1')).length, 1, 'nao criou uma segunda categoria SALDO');
});

test('acha a categoria SALDO pela flag, mesmo renomeada', async () => {
  const { categories, ids } = setup();
  const original = await ensureBalanceCategory(categories, ids, 'u1');
  const stored = await categories.findById('u1', original.id);
  assert.ok(stored);
  await categories.save(stored.rename(CategoryName.create('Saldo anterior')));

  const found = await ensureBalanceCategory(categories, ids, 'u1');

  assert.equal(found.id, original.id);
  assert.equal(found.name.value, 'SALDO ANTERIOR');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('nao confunde a categoria SALDO de um usuario com a de outro', async () => {
  const { categories, ids } = setup();

  const one = await ensureBalanceCategory(categories, ids, 'u1');
  const other = await ensureBalanceCategory(categories, ids, 'u2');

  assert.notEqual(other.id, one.id);
  assert.equal(other.userId, 'u2');
});
