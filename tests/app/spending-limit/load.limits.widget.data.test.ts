import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLimitsWidgetData, type LimitsWidgetSources } from '../../../src/app/spending-limit/load.limits.widget.data.ts';
import { buildUseCases } from '../../../src/composition/build.use.cases.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { FakeEmailSender } from '../../../src/notification/fake/email.sender.fake.ts';
import { FakeSmsSender } from '../../../src/notification/fake/sms.sender.fake.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { FakePasswordHasher } from '../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../support/fake.recovery.key.generator.ts';
import { FixedCodeGenerator } from '../../support/fixed.code.generator.ts';

/** Carregador do widget de limites sobre o banco em memoria (spec 023, T005). */
const U = 'u1';
const SEPT = { year: 2026, month: 9 };

async function setup() {
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
    User.create({ id: U, cpf: Cpf.create('52998224725'), email: Email.create('m@exemplo.com'), phone: Phone.create('11987654321'), name: 'Marco', createdAt: new Date() }),
  );
  await db.categories.save(Category.create({ id: 'c-comb', userId: U, name: CategoryName.create('Combustivel') }));
  await db.categories.save(Category.create({ id: 'c-merc', userId: U, name: CategoryName.create('Mercado') }));
  for (const [id, cat] of [['l-comb', 'c-comb'], ['l-merc', 'c-merc']] as const) {
    await db.spendingLimits.save(SpendingLimit.create({ id, userId: U, categoryId: cat, period: Month.create(SEPT), maxAmount: Money.fromCents(10_000) }));
  }
  for (const id of ['iti', 'nubank', 'passai']) {
    const account = Account.create({ id, userId: U, name: id, kind: 'credit-card', openingBalance: Money.zero(), creditLimit: Money.fromCents(100_000), closingDay: 5, dueDay: 12 });
    await db.accounts.save(id === 'passai' ? account.archive() : account);
  }
  const consulted: string[] = [];
  const sources: LimitsWidgetSources = {
    listSpendingLimitsWithUsage: c.listSpendingLimitsWithUsage,
    listCategories: c.listCategories,
    listAccounts: c.listAccounts,
    calculateCreditCardAvailableLimit: {
      execute: (input) => {
        consulted.push(input.accountId);
        return c.calculateCreditCardAvailableLimit.execute(input);
      },
    },
  };
  return { sources, consulted };
}

test('so consulta o limite dos cartoes escolhidos e ativos; escondidos ficam fora', async () => {
  const { sources, consulted } = await setup();
  const data = await loadLimitsWidgetData(sources, U, { visibleCardIds: ['nubank', 'passai'], hiddenCategoryIds: ['c-merc'] }, SEPT);
  assert.deepEqual(consulted, ['nubank'], 'nao calcula cartao nao escolhido nem arquivado');
  assert.deepEqual(data.cards.map((row) => row.id), ['nubank']);
  assert.deepEqual(data.spendingLimits.map((row) => row.id), ['l-comb']);
});

test('padrao: todos os limites de gasto e nenhum cartao', async () => {
  const { sources, consulted } = await setup();
  const data = await loadLimitsWidgetData(sources, U, { visibleCardIds: [], hiddenCategoryIds: [] }, SEPT);
  assert.deepEqual(consulted, []);
  assert.equal(data.spendingLimits.length, 2);
  assert.deepEqual(data.cards, []);
});
