import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUseCases, type Container } from '../../../src/composition/build.use.cases.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { type BackupRecord } from '../../../src/app/shared/backup.record.schema.ts';
import { UnresolvedImportConflictError } from '../../../src/domain/backup/unresolved.import.conflict.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { FakeEmailSender } from '../../../src/notification/fake/email.sender.fake.ts';
import { FakeSmsSender } from '../../../src/notification/fake/sms.sender.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FakePasswordHasher } from '../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../support/fake.recovery.key.generator.ts';
import { FixedCodeGenerator } from '../../support/fixed.code.generator.ts';

/** Backup por periodo e importacao com conflitos (spec 022, T140; FR-016..FR-019). */
const U = 'u1';

async function setup(): Promise<{ db: FakeDatabase; c: Container }> {
  const db = new FakeDatabase();
  const c = buildUseCases({
    database: db,
    ids: new SequentialIdGenerator(),
    clock: new FixedClock(new Date('2026-09-25T12:00:00.000Z')),
    codes: new FixedCodeGenerator(),
    passwordHasher: new FakePasswordHasher(),
    recoveryKeys: new FakeRecoveryKeyGenerator(),
    emailSender: new FakeEmailSender(),
    smsSender: new FakeSmsSender(),
    deterministicIds: new Sha1DeterministicIdGenerator(),
  });
  await db.users.save(
    User.create({ id: U, cpf: Cpf.create('52998224725'), email: Email.create('m@exemplo.com'), phone: Phone.create('11987654321'), name: 'Marco', createdAt: new Date() })
      .verifyEmail(new Date())
      .verifyPhone(new Date()),
  );
  await db.categories.save(Category.create({ id: 'cat-1', userId: U, name: CategoryName.create('Mercado') }));
  await db.accounts.save(Account.create({ id: 'acc-1', userId: U, name: 'Itau', kind: 'checking', openingBalance: Money.zero() }));
  await db.accounts.save(Account.create({ id: 'acc-2', userId: U, name: 'Sem uso', kind: 'savings', openingBalance: Money.zero() }));
  for (const [date, cents] of [['2026-08-10', 1000], ['2026-09-10', 2000], ['2026-09-20', 3000]] as const) {
    await c.recordTransaction.execute({ userId: U, date, amountCents: cents, type: 'expense', categoryId: 'cat-1', accountId: 'acc-1' });
  }
  await c.recordInstallmentPurchase.execute({ userId: U, accountId: 'acc-1', amountCents: 9000, installments: 3, date: '2026-09-15', categoryId: 'cat-1' });
  return { db, c };
}

async function exportSeptember(c: Container): Promise<BackupRecord[]> {
  const out: BackupRecord[] = [];
  for await (const record of await c.exportPeriodBackup.execute({ userId: U, from: '2026-09-01', to: '2026-09-30' })) out.push(record);
  return out;
}

test('export do periodo: header.scope, lancamentos do mes, parcelas inteiras e so o referenciado', async () => {
  const { c } = await setup();
  const records = await exportSeptember(c);
  const header = records[0];
  assert.equal(header?.kind, 'header');
  assert.deepEqual(header?.kind === 'header' ? header.scope : null, { from: '2026-09-01', to: '2026-09-30' });
  const txs = records.filter((r) => r.kind === 'transaction');
  assert.equal(txs.length, 2 + 3, 'dois avulsos de setembro + as 3 parcelas (inclusive as de outubro/novembro)');
  assert.deepEqual(records.filter((r) => r.kind === 'account').map((r) => (r as { id: string }).id), ['acc-1']);
  await assert.rejects(c.exportPeriodBackup.execute({ userId: U, from: '2026-09-30', to: '2026-09-01' }), { code: 'INVALID_INPUT' });
});

test('plano nao grava; iguais sao ignorados; conflito exige decisao; aplicar e tudo-ou-nada', async () => {
  const { db, c } = await setup();
  const file = (await exportSeptember(c)) as unknown as Record<string, unknown>[];
  const target = file.find((r) => r['kind'] === 'transaction' && r['amountCents'] === 2000)!;
  const altered = file.map((r) => (r === target ? { ...r, amountCents: 2500 } : r));
  const before = (await db.transactions.listByUser(U)).length;

  const plan = await c.planImport.execute({ userId: U, records: altered });
  assert.deepEqual(plan.summary, { new: 0, identical: file.length - 2, conflicts: 1 });
  assert.equal(plan.scope?.from, '2026-09-01');
  assert.equal((await db.transactions.listByUser(U)).length, before, 'plano nao grava');

  await assert.rejects(c.applyImport.execute({ userId: U, records: altered }), UnresolvedImportConflictError);

  const id = plan.conflicts[0]!.conflictId;
  await c.applyImport.execute({ userId: U, records: altered, decisions: { [id]: 'replace' } });
  assert.ok((await db.transactions.listByUser(U)).some((t) => t.amount.cents === 2500));
  assert.equal((await db.transactions.listByUser(U)).length, before);

  const again = altered.map((r) => (r === altered.find((x) => x['amountCents'] === 2500) ? { ...r, amountCents: 7777 } : r));
  await c.applyImport.execute({ userId: U, records: again, defaultDecision: 'keep-both' });
  assert.equal((await db.transactions.listByUser(U)).length, before + 1, 'manter os dois cria uma copia');
});

test('falha no meio da aplicacao nao deixa nada gravado', async () => {
  const { db, c } = await setup();
  const file = (await exportSeptember(c)) as unknown as Record<string, unknown>[];
  const withNew = [...file, { ...file.find((r) => r['kind'] === 'transaction')!, id: 'novo-1', amountCents: 1 }, { kind: 'transaction', id: 'quebrado', userId: U }];
  const before = (await db.transactions.listByUser(U)).length;
  await assert.rejects(c.applyImport.execute({ userId: U, records: withNew }));
  assert.equal((await db.transactions.listByUser(U)).length, before);
});
