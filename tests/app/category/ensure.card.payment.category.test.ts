import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureCardPaymentCategory } from '../../../src/app/category/ensure.card.payment.category.ts';
import { ensureTransferCategory } from '../../../src/app/category/ensure.transfer.category.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => ({ categories: new FakeCategoryRepository(), ids: new SequentialIdGenerator('cat') });

test('cria a categoria de sistema de pagamento de fatura quando o usuario nao tem nenhuma (spec 016, RF-2)', async () => {
  const { categories, ids } = setup();

  const created = await ensureCardPaymentCategory(categories, ids, 'u1');

  assert.equal(created.name.value, 'PAGAMENTO DE FATURA');
  assert.equal(created.isSystemCardPayment, true);
  assert.equal(created.userId, 'u1');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('e idempotente: a segunda chamada devolve a mesma categoria, sem duplicar', async () => {
  const { categories, ids } = setup();

  const first = await ensureCardPaymentCategory(categories, ids, 'u1');
  const second = await ensureCardPaymentCategory(categories, ids, 'u1');

  assert.equal(second.id, first.id);
  assert.equal(
    (await categories.listByUser('u1')).length,
    1,
    'nao criou uma segunda categoria de pagamento',
  );
});

test('acha a categoria de pagamento pela flag, mesmo renomeada', async () => {
  const { categories, ids } = setup();
  const original = await ensureCardPaymentCategory(categories, ids, 'u1');
  const stored = await categories.findById('u1', original.id);
  assert.ok(stored);
  await categories.save(stored.rename(CategoryName.create('Fatura paga')));

  const found = await ensureCardPaymentCategory(categories, ids, 'u1');

  assert.equal(found.id, original.id);
  assert.equal(found.name.value, 'FATURA PAGA');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('nao confunde a categoria de pagamento de um usuario com a de outro', async () => {
  const { categories, ids } = setup();

  const one = await ensureCardPaymentCategory(categories, ids, 'u1');
  const other = await ensureCardPaymentCategory(categories, ids, 'u2');

  assert.notEqual(other.id, one.id);
  assert.equal(other.userId, 'u2');
});

test('categoria de transferencia e de pagamento nunca se confundem entre si', async () => {
  const { categories, ids } = setup();

  const transfer = await ensureTransferCategory(categories, ids, 'u1');
  const cardPayment = await ensureCardPaymentCategory(categories, ids, 'u1');

  assert.notEqual(transfer.id, cardPayment.id);
  assert.equal(transfer.isSystemTransfer, true);
  assert.equal(transfer.isSystemCardPayment, false);
  assert.equal(cardPayment.isSystemCardPayment, true);
  assert.equal(cardPayment.isSystemTransfer, false);
});
