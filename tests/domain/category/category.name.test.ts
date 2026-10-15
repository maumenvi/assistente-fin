import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_NAME_MAX_LENGTH,
  CategoryName,
} from '../../../src/domain/category/category.name.value.object.ts';
import { DEFAULT_CATEGORY_NAME } from '../../../src/domain/category/default.category.name.ts';
import { InvalidCategoryError } from '../../../src/domain/category/invalid.category.error.ts';

test('create: guarda o nome em MAIUSCULAS (CA-1)', () => {
  assert.equal(CategoryName.create('Mercado').value, 'MERCADO');
  assert.equal(CategoryName.create('mercado').value, 'MERCADO');
  assert.equal(CategoryName.create('contas basicas').value, 'CONTAS BASICAS');
});

test('create: acentos sobem junto', () => {
  assert.equal(CategoryName.create('alimentação').value, 'ALIMENTAÇÃO');
});

test('create: trim e colapso de espacos internos', () => {
  assert.equal(CategoryName.create('  a  b ').value, 'A B');
  assert.equal(CategoryName.create('plano\tde\n saude').value, 'PLANO DE SAUDE');
});

test('create: nome vazio ou so espacos e recusado (CA-29)', () => {
  assert.throws(() => CategoryName.create(''), InvalidCategoryError);
  assert.throws(() => CategoryName.create('    '), InvalidCategoryError);
  assert.throws(() => CategoryName.create('\t\n '), /nome vazio/);
});

test('create: aceita exatamente 50 caracteres e recusa 51 (CA-29)', () => {
  const atLimit = 'x'.repeat(CATEGORY_NAME_MAX_LENGTH);
  assert.equal(CategoryName.create(atLimit).value, atLimit.toUpperCase());

  assert.throws(
    () => CategoryName.create('x'.repeat(CATEGORY_NAME_MAX_LENGTH + 1)),
    InvalidCategoryError,
  );
});

test('create: o limite vale sobre o nome ja normalizado', () => {
  // 50 caracteres uteis + espacos nas pontas continuam cabendo.
  const raw = `  ${'x'.repeat(CATEGORY_NAME_MAX_LENGTH)}  `;
  assert.equal(CategoryName.create(raw).value.length, CATEGORY_NAME_MAX_LENGTH);
});

test('equals: comparacao e case-normalizada (CA-10)', () => {
  const typed = CategoryName.create('mercado');
  const stored = CategoryName.create('Mercado');

  assert.equal(typed.equals(stored), true);
  assert.equal(typed.equals(CategoryName.create(' MERCADO ')), true);
  assert.equal(typed.equals(CategoryName.create('mercadinho')), false);
});

test('normalize: mesma forma do value object, sem validar', () => {
  assert.equal(CategoryName.normalize('  Mercado  Livre '), 'MERCADO LIVRE');
  assert.equal(CategoryName.normalize('   '), '');
  assert.equal(
    CategoryName.normalize('y'.repeat(CATEGORY_NAME_MAX_LENGTH + 1)).length,
    CATEGORY_NAME_MAX_LENGTH + 1,
  );
});

test('DEFAULT_CATEGORY_NAME ja esta na forma normalizada (RF-8)', () => {
  assert.equal(CategoryName.create(DEFAULT_CATEGORY_NAME).value, DEFAULT_CATEGORY_NAME);
});
