import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type AccessKeyRepositoryPort } from '../../../src/app/shared/access.key.repository.port.ts';

/**
 * Suite de contrato de `AccessKeyRepositoryPort` (spec 004, RF-13; plano, decisao D1/R11).
 *
 * Reutilizavel: cada adaptador (fake, Prisma) chama esta funcao com uma fabrica que devolve
 * um repositorio limpo. Assume que os usuarios `u1`/`u2` existem no escopo de quem chama
 * (o adaptador `fake` nao exige; o Prisma precisa de `seedFixtureUsers`). O repositorio
 * nunca le o relogio — os testes passam `Date`s explicitos, sem sleeps nem clocks fake.
 */
export function runAccessKeyRepositoryContract(
  label: string,
  createRepository: () => AccessKeyRepositoryPort,
): void {
  test(`${label}: sem chave gerada, getActive/listValidNow devolvem vazio`, async () => {
    const repo = createRepository();
    assert.equal(await repo.getActive(), null);
    assert.deepEqual(await repo.listValidNow(new Date()), []);
  });

  test(`${label}: replaceActive cria a primeira chave ativa`, async () => {
    const repo = createRepository();
    await repo.replaceActive('u1', 'hash-a');

    const active = await repo.getActive();
    assert.equal(active?.userId, 'u1');
    assert.equal(active?.keyHash, 'hash-a');
    assert.equal(active?.revokedAt, null);
    assert.ok(active?.id);
    assert.ok(active?.createdAt instanceof Date);
  });

  test(`${label}: revogacao imediata (sem janela) - a chave anterior deixa de valer na hora (CA-6, CA-7)`, async () => {
    const repo = createRepository();
    await repo.replaceActive('u1', 'hash-a');

    await repo.replaceActive('u1', 'hash-b');

    const active = await repo.getActive();
    assert.equal(active?.keyHash, 'hash-b');

    const valid = await repo.listValidNow(new Date());
    assert.equal(valid.length, 1, 'so a nova chave deve valer - a anterior foi apagada');
    assert.equal(valid[0]?.keyHash, 'hash-b');
  });

  test(`${label}: com janela de graca, a chave anterior ainda vale antes do prazo e some depois (R11)`, async () => {
    const repo = createRepository();
    await repo.replaceActive('u1', 'hash-a');

    const graceEnd = new Date('2026-09-11T13:00:00.000Z');
    await repo.replaceActive('u1', 'hash-b', { previousRevokedAt: graceEnd });

    const activeAfter = await repo.getActive();
    assert.equal(activeAfter?.keyHash, 'hash-b');

    const beforeGraceEnds = new Date(graceEnd.getTime() - 1);
    const validBefore = await repo.listValidNow(beforeGraceEnds);
    assert.deepEqual(
      validBefore.map((r) => r.keyHash).sort(),
      ['hash-a', 'hash-b'],
      'ambas devem valer antes do fim da janela de graca',
    );

    const afterGraceEnds = new Date(graceEnd.getTime() + 1);
    const validAfter = await repo.listValidNow(afterGraceEnds);
    assert.deepEqual(
      validAfter.map((r) => r.keyHash),
      ['hash-b'],
      'passado o fim da janela, so a chave ativa deve valer',
    );
  });

  test(`${label}: uma 3a rotacao nunca deixa mais de 1 chave revogada pendurada`, async () => {
    const repo = createRepository();
    const farFuture = new Date('2099-01-01T00:00:00.000Z');
    await repo.replaceActive('u1', 'hash-a');
    await repo.replaceActive('u1', 'hash-b', { previousRevokedAt: farFuture });
    await repo.replaceActive('u1', 'hash-c', { previousRevokedAt: farFuture });

    const valid = await repo.listValidNow(new Date());
    const hashes = valid.map((r) => r.keyHash).sort();
    // hash-a ja deveria ter sido substituida (nao fica empilhando revogadas): so a
    // rotacao mais recente (hash-b) e a ativa (hash-c) podem estar presentes.
    assert.ok(!hashes.includes('hash-a'), 'a revogada de 2 rotacoes atras nao deve sobreviver');
    assert.ok(hashes.includes('hash-c'), 'a chave ativa sempre vale');
  });

  test(`${label}: replaceActive troca o usuario associado a chave ativa`, async () => {
    const repo = createRepository();
    await repo.replaceActive('u1', 'hash-a');
    await repo.replaceActive('u2', 'hash-b');

    const active = await repo.getActive();
    assert.equal(active?.userId, 'u2');
  });
}
