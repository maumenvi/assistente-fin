import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureTransferCategory } from '../../../src/app/category/ensure.transfer.category.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => ({ categories: new FakeCategoryRepository(), ids: new SequentialIdGenerator('cat') });

test('cria a categoria de sistema de transferencia quando o usuario nao tem nenhuma (spec 016, RF-1)', async () => {
  const { categories, ids } = setup();

  const created = await ensureTransferCategory(categories, ids, 'u1');

  assert.equal(created.name.value, 'TRANSFERÊNCIAS');
  assert.equal(created.isSystemTransfer, true);
  assert.equal(created.userId, 'u1');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('e idempotente: a segunda chamada devolve a mesma categoria, sem duplicar', async () => {
  const { categories, ids } = setup();

  const first = await ensureTransferCategory(categories, ids, 'u1');
  const second = await ensureTransferCategory(categories, ids, 'u1');

  assert.equal(second.id, first.id);
  assert.equal(
    (await categories.listByUser('u1')).length,
    1,
    'nao criou uma segunda categoria de transferencia',
  );
});

test('acha a categoria de transferencia pela flag, mesmo renomeada', async () => {
  const { categories, ids } = setup();
  const original = await ensureTransferCategory(categories, ids, 'u1');
  const stored = await categories.findById('u1', original.id);
  assert.ok(stored);
  await categories.save(stored.rename(CategoryName.create('Movimentacao interna')));

  const found = await ensureTransferCategory(categories, ids, 'u1');

  assert.equal(found.id, original.id);
  assert.equal(found.name.value, 'MOVIMENTACAO INTERNA');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('nao confunde a categoria de transferencia de um usuario com a de outro', async () => {
  const { categories, ids } = setup();

  const one = await ensureTransferCategory(categories, ids, 'u1');
  const other = await ensureTransferCategory(categories, ids, 'u2');

  assert.notEqual(other.id, one.id);
  assert.equal(other.userId, 'u2');
});
