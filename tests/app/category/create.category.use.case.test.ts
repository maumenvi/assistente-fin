import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateCategoryUseCase } from '../../../src/app/category/create.category.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { DuplicateCategoryError } from '../../../src/domain/category/duplicate.category.error.ts';
import { FakeCategoryRepository } from '../../../src/database/fake/category.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const setup = () => {
  const categories = new FakeCategoryRepository();
  return { categories, useCase: new CreateCategoryUseCase(categories, new SequentialIdGenerator('cat')) };
};

test('cria a categoria com o nome em MAIUSCULAS (CA-1)', async () => {
  const { categories, useCase } = setup();

  const created = await useCase.execute({ userId: 'u1', name: 'Mercado' });

  assert.equal(created.name.value, 'MERCADO');
  assert.equal(created.userId, 'u1');
  assert.equal(created.isDefault, false, 'categoria criada a mao nunca nasce padrao');
  assert.equal((await categories.findById('u1', created.id))?.name.value, 'MERCADO');
});

test('nome que ja existe (em qualquer caixa) -> DuplicateCategoryError (CA-2)', async () => {
  const { useCase } = setup();
  await useCase.execute({ userId: 'u1', name: 'Mercado' });

  await assert.rejects(useCase.execute({ userId: 'u1', name: 'mercado' }), DuplicateCategoryError);
  await assert.rejects(
    useCase.execute({ userId: 'u1', name: '  MERCADO  ' }),
    DuplicateCategoryError,
  );
});

test('o mesmo nome em outro usuario e permitido', async () => {
  const { categories, useCase } = setup();
  await useCase.execute({ userId: 'u1', name: 'Mercado' });

  const other = await useCase.execute({ userId: 'u2', name: 'Mercado' });

  assert.equal(other.userId, 'u2');
  assert.equal((await categories.listByUser('u1')).length, 1);
  assert.equal((await categories.listByUser('u2')).length, 1);
});

test('entrada invalida -> InvalidInputError antes de tocar o dominio (001/CA-11)', async () => {
  const { categories, useCase } = setup();

  await assert.rejects(useCase.execute({ userId: '', name: 'Mercado' }), InvalidInputError);
  await assert.rejects(useCase.execute({ userId: 'u1', name: '   ' }), InvalidInputError);
  await assert.rejects(useCase.execute({ userId: 'u1' }), InvalidInputError);
  assert.deepEqual(await categories.listByUser('u1'), []);
});

test('nome acima de 50 caracteres e recusado na borda (CA-29)', async () => {
  const { useCase } = setup();

  await assert.rejects(
    useCase.execute({ userId: 'u1', name: 'x'.repeat(51) }),
    InvalidInputError,
    'o zod barra antes do dominio',
  );
});

test('o zod barra o que o dominio barraria: normalizar so encurta', async () => {
  const { useCase } = setup();
  // colapsar espacos internos nunca aumenta o tamanho, entao passar no `max(50)` do zod
  // implica passar no `CategoryName` - a checagem do dominio e defesa em profundidade,
  // nao um segundo caminho de erro para o usuario.
  const withInnerSpaces = `${'x'.repeat(24)}   ${'y'.repeat(23)}`;
  assert.equal(withInnerSpaces.length, 50, 'no limite do zod');
  const created = await useCase.execute({ userId: 'u1', name: withInnerSpaces });

  assert.equal(created.name.value, `${'X'.repeat(24)} ${'Y'.repeat(23)}`);
  assert.ok(created.name.value.length <= 50);
});
