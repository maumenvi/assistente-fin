import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { DEFAULT_CATEGORY_NAME } from '../../../src/domain/category/default.category.name.ts';
import { BALANCE_CATEGORY_NAME } from '../../../src/domain/category/balance.category.name.ts';
import { TRANSFER_CATEGORY_NAME } from '../../../src/domain/category/transfer.category.name.ts';
import { CARD_PAYMENT_CATEGORY_NAME } from '../../../src/domain/category/card.payment.category.name.ts';
import { InvalidCategoryError } from '../../../src/domain/category/invalid.category.error.ts';

const name = (raw: string) => CategoryName.create(raw);

const aCategory = (overrides: Partial<Parameters<typeof Category.create>[0]> = {}) =>
  Category.create({ id: 'cat-1', userId: 'user-1', name: name('Mercado'), ...overrides });

test('create: nasce comum e sem updatedAt', () => {
  const category = aCategory();

  assert.equal(category.id, 'cat-1');
  assert.equal(category.userId, 'user-1');
  assert.equal(category.name.value, 'MERCADO');
  assert.equal(category.isDefault, false);
  assert.equal(category.isSystemBalance, false);
  assert.equal(category.updatedAt, null);
});

test('create: a categoria padrao e marcada por flag, nao pelo nome (RF-8)', () => {
  const category = aCategory({ name: name(DEFAULT_CATEGORY_NAME), isDefault: true });

  assert.equal(category.isDefault, true);
  assert.equal(category.name.value, 'SEM CATEGORIA');
});

test('create: a categoria SALDO e marcada por flag, nao pelo nome (spec 011, RF-16)', () => {
  const category = aCategory({ name: name(BALANCE_CATEGORY_NAME), isSystemBalance: true });

  assert.equal(category.isSystemBalance, true);
  assert.equal(category.name.value, 'SALDO');
});

test('create: isSystemTransfer/isSystemCardPayment nascem false por padrao', () => {
  const category = aCategory();

  assert.equal(category.isSystemTransfer, false);
  assert.equal(category.isSystemCardPayment, false);
});

test('create: a categoria de transferencia e marcada por flag, nao pelo nome (spec 016, RF-1)', () => {
  const category = aCategory({ name: name(TRANSFER_CATEGORY_NAME), isSystemTransfer: true });

  assert.equal(category.isSystemTransfer, true);
  assert.equal(category.isSystemCardPayment, false);
  assert.equal(category.name.value, 'TRANSFERÊNCIAS');
});

test('create: a categoria de pagamento de fatura e marcada por flag, nao pelo nome (spec 016, RF-2)', () => {
  const category = aCategory({
    name: name(CARD_PAYMENT_CATEGORY_NAME),
    isSystemCardPayment: true,
  });

  assert.equal(category.isSystemCardPayment, true);
  assert.equal(category.isSystemTransfer, false);
  assert.equal(category.name.value, 'PAGAMENTO DE FATURA');
});

test('rename: isSystemTransfer/isSystemCardPayment sobrevivem ao rename (mesma estabilidade de isSystemBalance)', () => {
  const transfer = aCategory({
    name: name(TRANSFER_CATEGORY_NAME),
    isSystemTransfer: true,
  }).rename(name('Movimentacao interna'));
  const cardPayment = aCategory({
    name: name(CARD_PAYMENT_CATEGORY_NAME),
    isSystemCardPayment: true,
  }).rename(name('Fatura paga'));

  assert.equal(transfer.isSystemTransfer, true);
  assert.equal(cardPayment.isSystemCardPayment, true);
});

test('create: id e userId sao obrigatorios', () => {
  assert.throws(() => aCategory({ id: '  ' }), InvalidCategoryError);
  assert.throws(() => aCategory({ userId: '' }), InvalidCategoryError);
});

test('create: id e userId sao normalizados com trim', () => {
  const category = aCategory({ id: ' cat-1 ', userId: ' user-1 ' });

  assert.equal(category.id, 'cat-1');
  assert.equal(category.userId, 'user-1');
});

test('create: nome precisa ser CategoryName (defesa em profundidade)', () => {
  assert.throws(
    () => aCategory({ name: 'MERCADO' as unknown as CategoryName }),
    /nome deve ser CategoryName/,
  );
});

test('rename: troca o nome mantendo id (base da propagacao, CA-3)', () => {
  const category = aCategory();
  const renamed = category.rename(name('mercado do bairro'));

  assert.equal(renamed.name.value, 'MERCADO DO BAIRRO');
  assert.equal(renamed.id, category.id);
  assert.equal(renamed.userId, category.userId);
  // imutavel: a instancia original nao muda
  assert.equal(category.name.value, 'MERCADO');
});

test('rename: a categoria padrao pode ser renomeada e continua padrao (CA-6)', () => {
  const original = aCategory({ name: name(DEFAULT_CATEGORY_NAME), isDefault: true });
  const renamed = original.rename(name('A classificar'));

  assert.equal(renamed.name.value, 'A CLASSIFICAR');
  assert.equal(renamed.isDefault, true);
});

test('rename: preserva o updatedAt (a trava otimista e do repositorio)', () => {
  const stamp = new Date('2026-09-10T12:00:00.000Z');
  const category = Category.fromPersistence({
    id: 'cat-1',
    userId: 'user-1',
    name: name('Mercado'),
    updatedAt: stamp,
  });

  assert.equal(category.rename(name('Feira')).updatedAt?.toISOString(), stamp.toISOString());
});

test('rename: recusa nome que nao e CategoryName', () => {
  assert.throws(
    () => aCategory().rename('FEIRA' as unknown as CategoryName),
    /nome deve ser CategoryName/,
  );
});

test('a entidade nao expoe exclusao (RF-7, CA-4)', () => {
  const category = aCategory() as unknown as Record<string, unknown>;

  assert.equal(category['delete'], undefined);
  assert.equal(category['archive'], undefined);
});

test('fromPersistence: round-trip de todos os campos', () => {
  const stamp = new Date('2026-09-10T12:00:00.000Z');
  const category = Category.fromPersistence({
    id: 'cat-9',
    userId: 'user-2',
    name: name('SEM CATEGORIA'),
    isDefault: true,
    updatedAt: stamp,
  });

  assert.equal(category.id, 'cat-9');
  assert.equal(category.userId, 'user-2');
  assert.equal(category.name.value, 'SEM CATEGORIA');
  assert.equal(category.isDefault, true);
  assert.equal(category.isSystemBalance, false);
  assert.equal(category.updatedAt?.toISOString(), stamp.toISOString());
});

test('fromPersistence: updatedAt invalido e recusado', () => {
  assert.throws(
    () =>
      Category.fromPersistence({
        id: 'cat-1',
        userId: 'user-1',
        name: name('Mercado'),
        updatedAt: new Date('nao-e-data'),
      }),
    /updatedAt/,
  );
});

test('withUpdatedAt: carimba e devolve nova instancia', () => {
  const category = aCategory();
  const stamp = new Date('2026-09-10T12:00:00.000Z');
  const stamped = category.withUpdatedAt(stamp);

  assert.equal(stamped.updatedAt?.toISOString(), stamp.toISOString());
  assert.equal(stamped.name.value, category.name.value);
  assert.equal(stamped.isDefault, category.isDefault);
  assert.equal(category.updatedAt, null);
  assert.equal(stamped.withUpdatedAt(null).updatedAt, null);
});
