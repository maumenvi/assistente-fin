import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type CategoryRepository } from '../../../src/app/category/category.repository.port.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { DEFAULT_CATEGORY_NAME } from '../../../src/domain/category/default.category.name.ts';
import { TRANSFER_CATEGORY_NAME } from '../../../src/domain/category/transfer.category.name.ts';
import { CARD_PAYMENT_CATEGORY_NAME } from '../../../src/domain/category/card.payment.category.name.ts';

const name = (raw: string) => CategoryName.create(raw);

const category = (id: string, userId: string, raw: string, isDefault = false): Category =>
  Category.create({ id, userId, name: name(raw), isDefault });

/**
 * Suite de contrato do `CategoryRepository`.
 *
 * Reutilizavel: cada adaptador (fake e Prisma) chama esta funcao com uma fabrica que devolve
 * um repositorio limpo. Garante o mesmo comportamento observavel em qualquer banco
 * (001/CA-19, CA-20).
 */
export function runCategoryRepositoryContract(
  label: string,
  createRepository: () => CategoryRepository,
): void {
  test(`${label}: save + findById dentro do escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(category('c1', 'u1', 'Mercado'));

    const found = await repo.findById('u1', 'c1');
    assert.equal(found?.name.value, 'MERCADO');
    assert.equal(found?.isDefault, false);
    assert.equal(await repo.findById('u1', 'inexistente'), null);
  });

  test(`${label}: findById nao vaza categoria de outro usuario (CA-30)`, async () => {
    const repo = createRepository();
    await repo.save(category('c1', 'u1', 'Mercado'));

    assert.equal(await repo.findById('u2', 'c1'), null);
  });

  test(`${label}: save sobrescreve pelo id`, async () => {
    const repo = createRepository();
    const original = category('c1', 'u1', 'Mercado');
    await repo.save(original);
    const stored = await repo.findById('u1', 'c1');
    assert.ok(stored);
    await repo.save(stored.rename(name('Feira')));

    const all = await repo.listByUser('u1');
    assert.equal(all.length, 1);
    assert.equal(all[0]?.name.value, 'FEIRA');
  });

  test(`${label}: findByName acha pelo nome normalizado (CA-10)`, async () => {
    const repo = createRepository();
    await repo.save(category('c1', 'u1', 'Mercado'));

    // qualquer caixa digitada pelo usuario normaliza para a mesma chave
    assert.equal((await repo.findByName('u1', name('mercado')))?.id, 'c1');
    assert.equal((await repo.findByName('u1', name('  MeRcAdO  ')))?.id, 'c1');
    assert.equal(await repo.findByName('u1', name('Mercadinho')), null);
  });

  test(`${label}: findByName e por usuario - o mesmo nome coexiste em usuarios diferentes`, async () => {
    const repo = createRepository();
    await repo.save(category('c1', 'u1', 'Mercado'));
    await repo.save(category('c2', 'u2', 'Mercado'));

    assert.equal((await repo.findByName('u1', name('Mercado')))?.id, 'c1');
    assert.equal((await repo.findByName('u2', name('Mercado')))?.id, 'c2');
    assert.equal(await repo.findByName('u3', name('Mercado')), null);
  });

  test(`${label}: findDefault devolve a categoria padrao do usuario (RF-8)`, async () => {
    const repo = createRepository();
    assert.equal(await repo.findDefault('u1'), null, 'sem padrao antes de criar');

    await repo.save(category('c0', 'u1', DEFAULT_CATEGORY_NAME, true));
    await repo.save(category('c1', 'u1', 'Mercado'));
    await repo.save(category('c9', 'u2', DEFAULT_CATEGORY_NAME, true));

    const found = await repo.findDefault('u1');
    assert.equal(found?.id, 'c0');
    assert.equal(found?.isDefault, true);
  });

  test(`${label}: findDefault segue a flag, nao o nome - a padrao pode ser renomeada (CA-6)`, async () => {
    const repo = createRepository();
    await repo.save(category('c0', 'u1', DEFAULT_CATEGORY_NAME, true));
    const stored = await repo.findDefault('u1');
    assert.ok(stored);

    await repo.save(stored.rename(name('A classificar')));

    const renamed = await repo.findDefault('u1');
    assert.equal(renamed?.id, 'c0');
    assert.equal(renamed?.name.value, 'A CLASSIFICAR');
  });

  test(`${label}: listByUser filtra por usuario e ordena por nome`, async () => {
    const repo = createRepository();
    await repo.save(category('c1', 'u1', 'Mercado'));
    await repo.save(category('c2', 'u1', 'Aluguel'));
    await repo.save(category('c3', 'u1', 'Transporte'));
    await repo.save(category('c4', 'u2', 'Outro'));

    const names = (await repo.listByUser('u1')).map((c) => c.name.value);
    assert.deepEqual(names, ['ALUGUEL', 'MERCADO', 'TRANSPORTE']);
    assert.deepEqual(await repo.listByUser('u3'), []);
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(category('c1', 'u1', 'Mercado'));
    const v1 = await repo.findById('u1', 'c1');
    const v2 = await repo.findById('u1', 'c1');
    assert.ok(v1 && v2);
    await repo.save(v1.rename(name('Feira')));
    await assert.rejects(repo.save(v2.rename(name('Compras'))), StaleDataError);
  });

  test(`${label}: findSystemTransfer devolve a categoria de transferencia do usuario (spec 016, RF-1)`, async () => {
    const repo = createRepository();
    assert.equal(await repo.findSystemTransfer('u1'), null, 'sem categoria de transferencia antes de criar');

    await repo.save(
      Category.create({ id: 'c0', userId: 'u1', name: name(TRANSFER_CATEGORY_NAME), isSystemTransfer: true }),
    );
    await repo.save(category('c1', 'u1', 'Mercado'));
    await repo.save(
      Category.create({ id: 'c9', userId: 'u2', name: name(TRANSFER_CATEGORY_NAME), isSystemTransfer: true }),
    );

    const found = await repo.findSystemTransfer('u1');
    assert.equal(found?.id, 'c0');
    assert.equal(found?.isSystemTransfer, true);
  });

  test(`${label}: findSystemTransfer segue a flag, nao o nome (renomeada continua achavel)`, async () => {
    const repo = createRepository();
    await repo.save(
      Category.create({ id: 'c0', userId: 'u1', name: name(TRANSFER_CATEGORY_NAME), isSystemTransfer: true }),
    );
    const stored = await repo.findSystemTransfer('u1');
    assert.ok(stored);

    await repo.save(stored.rename(name('Movimentacao interna')));

    const renamed = await repo.findSystemTransfer('u1');
    assert.equal(renamed?.id, 'c0');
    assert.equal(renamed?.name.value, 'MOVIMENTACAO INTERNA');
  });

  test(`${label}: findSystemCardPayment devolve a categoria de pagamento de fatura do usuario (spec 016, RF-2)`, async () => {
    const repo = createRepository();
    assert.equal(
      await repo.findSystemCardPayment('u1'),
      null,
      'sem categoria de pagamento antes de criar',
    );

    await repo.save(
      Category.create({
        id: 'c0',
        userId: 'u1',
        name: name(CARD_PAYMENT_CATEGORY_NAME),
        isSystemCardPayment: true,
      }),
    );
    await repo.save(category('c1', 'u1', 'Mercado'));

    const found = await repo.findSystemCardPayment('u1');
    assert.equal(found?.id, 'c0');
    assert.equal(found?.isSystemCardPayment, true);
  });

  test(`${label}: findSystemTransfer e findSystemCardPayment nunca se confundem`, async () => {
    const repo = createRepository();
    await repo.save(
      Category.create({ id: 'c0', userId: 'u1', name: name(TRANSFER_CATEGORY_NAME), isSystemTransfer: true }),
    );
    await repo.save(
      Category.create({
        id: 'c1',
        userId: 'u1',
        name: name(CARD_PAYMENT_CATEGORY_NAME),
        isSystemCardPayment: true,
      }),
    );

    assert.equal((await repo.findSystemTransfer('u1'))?.id, 'c0');
    assert.equal((await repo.findSystemCardPayment('u1'))?.id, 'c1');
  });
}
