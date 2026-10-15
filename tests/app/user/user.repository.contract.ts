import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';
import { type UserRepository } from '../../../src/app/user/user.repository.port.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';

const user = (
  id: string,
  cpfDigits: string,
  email: string,
  phone: string,
  name: string,
): User =>
  User.create({
    id,
    cpf: Cpf.create(cpfDigits),
    email: Email.create(email),
    phone: Phone.create(phone),
    name,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

/**
 * Suite de contrato do `UserRepository`.
 *
 * Reutilizavel: cada adaptador (fake hoje, Prisma tambem) chama esta funcao com uma fabrica
 * que devolve um repositorio limpo. Garante o mesmo comportamento observavel em qualquer
 * banco (CA-19, CA-20).
 */
export function runUserRepositoryContract(
  label: string,
  createRepository: () => UserRepository,
): void {
  test(`${label}: save + findById`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));

    const found = await repo.findById('u1');
    assert.equal(found?.name, 'Marco');
    assert.equal(await repo.findById('inexistente'), null);
  });

  test(`${label}: findByCpf encontra pelo cpf normalizado (CA-13)`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));

    const found = await repo.findByCpf(Cpf.create('529.982.247-25'));
    assert.equal(found?.id, 'u1');
    assert.equal(await repo.findByCpf(Cpf.create('11144477735')), null);
  });

  test(`${label}: findByEmail encontra pelo e-mail normalizado (RF-23)`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'Marco@Exemplo.com', '11987654321', 'Marco'));

    const found = await repo.findByEmail(Email.create('marco@exemplo.com'));
    assert.equal(found?.id, 'u1');
    assert.equal(await repo.findByEmail(Email.create('outro@exemplo.com')), null);
  });

  test(`${label}: findByPhone encontra pelo telefone normalizado (RF-23)`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '(11) 98765-4321', 'Marco'));

    const found = await repo.findByPhone(Phone.create('11987654321'));
    assert.equal(found?.id, 'u1');
    assert.equal(await repo.findByPhone(Phone.create('21987654321')), null);
  });

  test(`${label}: delete remove o usuario; silencioso se nao existe`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));

    await repo.delete('u1');
    assert.equal(await repo.findById('u1'), null);
    await repo.delete('u1'); // idempotente, nao lanca
  });

  test(`${label}: listAll devolve todos, do mais antigo ao mais novo (RF-10)`, async () => {
    const repo = createRepository();
    assert.deepEqual(await repo.listAll(), []);

    const older = user('u1', '52998224725', 'a@exemplo.com', '11987654321', 'Ana');
    const newer = User.create({
      id: 'u2',
      cpf: Cpf.create('11144477735'),
      email: Email.create('b@exemplo.com'),
      phone: Phone.create('21987654321'),
      name: 'Bruno',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    await repo.save(newer);
    await repo.save(older);

    assert.deepEqual((await repo.listAll()).map((u) => u.id), ['u1', 'u2']);
  });

  test(`${label}: save sobrescreve pelo id`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));
    await repo.save(
      user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco Aurelio'),
    );

    const found = await repo.findById('u1');
    assert.equal(found?.name, 'Marco Aurelio');
  });

  test(`${label}: persiste e limpa passwordHash / recoveryKeyHash (spec 002, RF-9)`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));

    const created = await repo.findById('u1');
    assert.ok(created);
    assert.equal(created.passwordHash, null);

    await repo.save(created.setPassword('scrypt$1$2$3$salt$dk').setRecoveryKey('scrypt$1$2$3$salt$rk'));
    const withSecret = await repo.findById('u1');
    assert.equal(withSecret?.passwordHash, 'scrypt$1$2$3$salt$dk');
    assert.equal(withSecret?.recoveryKeyHash, 'scrypt$1$2$3$salt$rk');

    assert.ok(withSecret);
    await repo.save(withSecret.removePassword());
    const cleared = await repo.findById('u1');
    assert.equal(cleared?.passwordHash, null);
    assert.equal(cleared?.recoveryKeyHash, null);
  });

  test(`${label}: persiste e limpa lowBalanceThresholdCents (spec 015, RF-2)`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));

    const created = await repo.findById('u1');
    assert.ok(created);
    assert.equal(created.lowBalanceThresholdCents, null);

    await repo.save(created.setLowBalanceThreshold(50_000));
    const withThreshold = await repo.findById('u1');
    assert.equal(withThreshold?.lowBalanceThresholdCents, 50_000);

    assert.ok(withThreshold);
    await repo.save(withThreshold.setLowBalanceThreshold(null));
    const cleared = await repo.findById('u1');
    assert.equal(cleared?.lowBalanceThresholdCents, null);
  });

  test(`${label}: save rejeita gravar sobre uma versao ja alterada (RF-31)`, async () => {
    const repo = createRepository();
    await repo.save(user('u1', '52998224725', 'marco@exemplo.com', '11987654321', 'Marco'));
    const v1 = await repo.findById('u1');
    const v2 = await repo.findById('u1');
    assert.ok(v1 && v2);
    await repo.save(v1);
    await assert.rejects(repo.save(v2), StaleDataError);
  });
}
