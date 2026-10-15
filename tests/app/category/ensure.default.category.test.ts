import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureDefaultCategory } from '../../../src/app/category/ensure.default.category.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => ({ categories: new FakeCategoryRepository(), ids: new SequentialIdGenerator('cat') });

test('cria a categoria padrao "SEM CATEGORIA" quando o usuario nao tem nenhuma (CA-5)', async () => {
  const { categories, ids } = setup();

  const created = await ensureDefaultCategory(categories, ids, 'u1');

  assert.equal(created.name.value, 'SEM CATEGORIA');
  assert.equal(created.isDefault, true);
  assert.equal(created.userId, 'u1');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('e idempotente: a segunda chamada devolve a mesma categoria (CA-5)', async () => {
  const { categories, ids } = setup();

  const first = await ensureDefaultCategory(categories, ids, 'u1');
  const second = await ensureDefaultCategory(categories, ids, 'u1');

  assert.equal(second.id, first.id);
  assert.equal((await categories.listByUser('u1')).length, 1, 'nao criou uma segunda padrao');
});

test('acha a padrao pela flag, mesmo renomeada (CA-6)', async () => {
  const { categories, ids } = setup();
  const original = await ensureDefaultCategory(categories, ids, 'u1');
  const stored = await categories.findById('u1', original.id);
  assert.ok(stored);
  await categories.save(stored.rename(CategoryName.create('A classificar')));

  const found = await ensureDefaultCategory(categories, ids, 'u1');

  assert.equal(found.id, original.id);
  assert.equal(found.name.value, 'A CLASSIFICAR');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('nao confunde a padrao de um usuario com a de outro', async () => {
  const { categories, ids } = setup();

  const one = await ensureDefaultCategory(categories, ids, 'u1');
  const other = await ensureDefaultCategory(categories, ids, 'u2');

  assert.notEqual(other.id, one.id);
  assert.equal(other.userId, 'u2');
});
