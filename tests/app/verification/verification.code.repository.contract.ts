import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type VerificationCodeRepository } from '../../../src/app/verification/verification.code.repository.port.ts';
import { VerificationCode } from '../../../src/domain/verification/verification.code.entity.ts';
import { type VerificationChannel } from '../../../src/domain/verification/verification.channel.ts';

const code = (
  id: string,
  userId: string,
  channel: VerificationChannel,
  createdAt: string,
): VerificationCode =>
  VerificationCode.create({
    id,
    userId,
    channel,
    code: '123456',
    createdAt: new Date(createdAt),
    expiresAt: new Date(new Date(createdAt).getTime() + 15 * 60_000),
  });

/**
 * Suite de contrato do `VerificationCodeRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20).
 */
export function runVerificationCodeRepositoryContract(
  label: string,
  createRepository: () => VerificationCodeRepository,
): void {
  test(`${label}: save + findLatestByUserAndChannel`, async () => {
    const repo = createRepository();
    await repo.save(code('vc1', 'u1', 'email', '2026-01-01T00:00:00.000Z'));

    const found = await repo.findLatestByUserAndChannel('u1', 'email');
    assert.equal(found?.id, 'vc1');
  });

  test(`${label}: sem codigo pra aquele usuario/canal devolve null`, async () => {
    const repo = createRepository();
    assert.equal(await repo.findLatestByUserAndChannel('inexistente', 'email'), null);
  });

  test(`${label}: devolve o mais recente quando ha varios (reenvio)`, async () => {
    const repo = createRepository();
    await repo.save(code('vc1', 'u1', 'email', '2026-01-01T00:00:00.000Z'));
    await repo.save(code('vc2', 'u1', 'email', '2026-01-01T00:05:00.000Z'));

    const found = await repo.findLatestByUserAndChannel('u1', 'email');
    assert.equal(found?.id, 'vc2');
  });

  test(`${label}: nao mistura usuarios nem canais diferentes`, async () => {
    const repo = createRepository();
    await repo.save(code('vc1', 'u1', 'email', '2026-01-01T00:00:00.000Z'));
    await repo.save(code('vc2', 'u1', 'phone', '2026-01-01T00:01:00.000Z'));
    await repo.save(code('vc3', 'u2', 'email', '2026-01-01T00:02:00.000Z'));

    assert.equal((await repo.findLatestByUserAndChannel('u1', 'email'))?.id, 'vc1');
    assert.equal((await repo.findLatestByUserAndChannel('u1', 'phone'))?.id, 'vc2');
    assert.equal((await repo.findLatestByUserAndChannel('u2', 'email'))?.id, 'vc3');
  });

  test(`${label}: save sobrescreve pelo id (ex.: confirmar o codigo)`, async () => {
    const repo = createRepository();
    const original = code('vc1', 'u1', 'email', '2026-01-01T00:00:00.000Z');
    await repo.save(original);

    const confirmed = original.confirm(new Date('2026-01-01T00:01:00.000Z'));
    await repo.save(confirmed);

    const found = await repo.findLatestByUserAndChannel('u1', 'email');
    assert.ok(found?.confirmedAt, 'deveria ter persistido a confirmacao');
  });
}
