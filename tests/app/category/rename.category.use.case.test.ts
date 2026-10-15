import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RenameCategoryUseCase } from '../../../src/app/category/rename.category.use.case.ts';
import { ensureDefaultCategory } from '../../../src/app/category/ensure.default.category.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { CategoryNotFoundError } from '../../../src/domain/category/category.not.found.error.ts';
import { DuplicateCategoryError } from '../../../src/domain/category/duplicate.category.error.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => {
  const categories = new FakeCategoryRepository();
  return { categories, useCase: new RenameCategoryUseCase(categories) };
};

const seed = async (categories: FakeCategoryRepository, id: string, userId: string, name: string) => {
  await categories.save(Category.create({ id, userId, name: CategoryName.create(name) }));
};

test('renomeia mantendo o id - e o que faz a mudanca propagar (CA-3)', async () => {
  const { categories, useCase } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  const renamed = await useCase.execute({ id: 'c1', userId: 'u1', name: 'mercado do bairro' });

  assert.equal(renamed.id, 'c1', 'o id nao muda: os lancamentos continuam apontando pra ela');
  assert.equal(renamed.name.value, 'MERCADO DO BAIRRO');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('renomear a categoria padrao e permitido e ela segue padrao (CA-6)', async () => {
  const { categories, useCase } = setup();
  const original = await ensureDefaultCategory(categories, new SequentialIdGenerator('cat'), 'u1');

  const renamed = await useCase.execute({ id: original.id, userId: 'u1', name: 'A classificar' });

  assert.equal(renamed.isDefault, true);
  assert.equal(renamed.name.value, 'A CLASSIFICAR');
  assert.equal((await categories.findDefault('u1'))?.id, original.id);
});

test('categoria de outro usuario -> CategoryNotFoundError (CA-30)', async () => {
  const { categories, useCase } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  await assert.rejects(
    useCase.execute({ id: 'c1', userId: 'u2', name: 'Feira' }),
    CategoryNotFoundError,
  );
});

test('nome de outra categoria do usuario -> DuplicateCategoryError (CA-2)', async () => {
  const { categories, useCase } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');
  await seed(categories, 'c2', 'u1', 'Transporte');

  await assert.rejects(
    useCase.execute({ id: 'c1', userId: 'u1', name: 'transporte' }),
    DuplicateCategoryError,
  );
  assert.equal((await categories.findById('u1', 'c1'))?.name.value, 'MERCADO', 'nada mudou');
});

test('renomear para o proprio nome (outra caixa) e no-op valido', async () => {
  const { categories, useCase } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  const renamed = await useCase.execute({ id: 'c1', userId: 'u1', name: 'mercado' });

  assert.equal(renamed.name.value, 'MERCADO');
  assert.equal((await categories.listByUser('u1')).length, 1);
});

test('expectedUpdatedAt desatualizado -> StaleDataError (RF-31)', async () => {
  const { categories, useCase } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');
  const asRead = await categories.findById('u1', 'c1');
  assert.ok(asRead?.updatedAt);
  const staleStamp = asRead.updatedAt.toISOString();

  // alguem gravou entre a leitura da tela e o envio
  await useCase.execute({ id: 'c1', userId: 'u1', name: 'Feira' });

  await assert.rejects(
    useCase.execute({ id: 'c1', userId: 'u1', name: 'Compras', expectedUpdatedAt: staleStamp }),
    StaleDataError,
  );
  assert.equal((await categories.findById('u1', 'c1'))?.name.value, 'FEIRA');
});

test('sem expectedUpdatedAt grava sobre a versao lida agora', async () => {
  const { categories, useCase } = setup();
  await seed(categories, 'c1', 'u1', 'Mercado');

  await useCase.execute({ id: 'c1', userId: 'u1', name: 'Feira' });
  const after = await useCase.execute({ id: 'c1', userId: 'u1', name: 'Compras' });

  assert.equal(after.name.value, 'COMPRAS');
  assert.ok(after.updatedAt, 'volta a versao persistida, ja recarimbada');
});

test('entrada invalida -> InvalidInputError', async () => {
  const { useCase } = setup();

  await assert.rejects(useCase.execute({ id: '', userId: 'u1', name: 'Feira' }), InvalidInputError);
  await assert.rejects(useCase.execute({ id: 'c1', userId: 'u1', name: '  ' }), InvalidInputError);
  await assert.rejects(
    useCase.execute({ id: 'c1', userId: 'u1', name: 'x'.repeat(51) }),
    InvalidInputError,
  );
});
