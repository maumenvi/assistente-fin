import { buildUseCases } from '../../../../src/composition/build.use.cases.ts';
import { FakeDatabase } from '../../../../src/database/fake/fake.database.ts';
import { Account } from '../../../../src/domain/account/account.entity.ts';
import { Category } from '../../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../../src/domain/category/category.name.value.object.ts';
import { FixedExpense } from '../../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { Income } from '../../../../src/domain/income/income.entity.ts';
import { Cpf } from '../../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../../src/domain/shared/email.value.object.ts';
import { Money } from '../../../../src/domain/shared/money.value.object.ts';
import { Phone } from '../../../../src/domain/shared/phone.value.object.ts';
import { Recurrence } from '../../../../src/domain/shared/recurrence.value.object.ts';
import { Transaction } from '../../../../src/domain/transaction/transaction.entity.ts';
import { User } from '../../../../src/domain/user/user.entity.ts';
import { Sha1DeterministicIdGenerator } from '../../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { FakeEmailSender } from '../../../../src/notification/fake/email.sender.fake.ts';
import { FakeSmsSender } from '../../../../src/notification/fake/sms.sender.fake.ts';
import { FakePasswordHasher } from '../../../support/fake.password.hasher.ts';
import { FakeRecoveryKeyGenerator } from '../../../support/fake.recovery.key.generator.ts';
import { FixedCodeGenerator } from '../../../support/fixed.code.generator.ts';
import { MutableClock } from '../../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../../support/sequential.id.generator.ts';
import { EVAL_NOW, EVAL_USER_ID, type EvalDataset } from './eval.dataset.ts';

/** Gerador pseudo-aleatorio com semente (mulberry32): a base e identica a cada execucao. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Categorias de gasto com a faixa de valor tipica (em centavos). */
const SPENDING: readonly { readonly id: string; readonly name: string; readonly min: number; readonly max: number }[] = [
  { id: 'cat-mercado', name: 'Mercado', min: 3_000, max: 28_000 },
  { id: 'cat-lazer', name: 'Lazer', min: 2_000, max: 15_000 },
  { id: 'cat-transporte', name: 'Transporte', min: 800, max: 9_000 },
  { id: 'cat-saude', name: 'Saúde', min: 3_000, max: 22_000 },
  { id: 'cat-restaurantes', name: 'Restaurantes', min: 2_500, max: 12_000 },
];

const SPENDING_ACCOUNTS = ['acc-itau', 'acc-carteira', 'card-nubank', 'card-iti'] as const;

/** Descricoes claras (mapeaveis para uma categoria existente) para os pendentes de classificacao (spec 037, T002). */
const UNCATEGORIZED_NOTES: readonly { readonly note: string; readonly cents: number }[] = [
  { note: 'Mercado Extra', cents: 14_500 },
  { note: 'Uber Viagem', cents: 2_890 },
  { note: 'Drogasil Farmácia', cents: 6_400 },
  { note: 'Restaurante Sabor', cents: 5_200 },
  { note: 'Cinema Ingresso', cents: 4_800 },
];

/** Meses cobertos: nov/2025 a out/2026 (12 meses); outubro so ate o dia 15. */
const MONTHS: readonly { readonly year: number; readonly month: number }[] = Array.from({ length: 12 }, (_, i) => ({ year: i < 2 ? 2025 : 2026, month: i < 2 ? 11 + i : i - 1 }));

/**
 * Monta a base sintetica da avaliacao (spec 031, T136): 3 contas de saldo, 2 cartoes, 12 meses de
 * lancamentos (>= 600) com categorias, compras parceladas, gastos fixos, ganhos e limites com uso.
 * Semente e relogio fixos (15/10/2026): dois builds sao identicos.
 */
export async function buildSyntheticDatabase(): Promise<EvalDataset> {
  const db = new FakeDatabase();
  const clock = new MutableClock(EVAL_NOW);
  const container = buildUseCases({
    database: db,
    ids: new SequentialIdGenerator('eval'),
    clock,
    codes: new FixedCodeGenerator(),
    passwordHasher: new FakePasswordHasher(),
    recoveryKeys: new FakeRecoveryKeyGenerator(),
    emailSender: new FakeEmailSender(),
    smsSender: new FakeSmsSender(),
    deterministicIds: new Sha1DeterministicIdGenerator(),
  });

  await db.users.save(
    User.create({
      id: EVAL_USER_ID,
      cpf: Cpf.create('52998224725'),
      email: Email.create('avaliacao@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Avaliação',
      createdAt: EVAL_NOW,
    })
      .verifyEmail(EVAL_NOW)
      .verifyPhone(EVAL_NOW),
  );
  await db.categories.save(Category.create({ id: 'cat-sem-categoria', userId: EVAL_USER_ID, name: CategoryName.create('SEM CATEGORIA'), isDefault: true }));
  await db.categories.save(Category.create({ id: 'cat-salario', userId: EVAL_USER_ID, name: CategoryName.create('Salário') }));
  await db.categories.save(Category.create({ id: 'cat-moradia', userId: EVAL_USER_ID, name: CategoryName.create('Moradia') }));
  for (const c of SPENDING) await db.categories.save(Category.create({ id: c.id, userId: EVAL_USER_ID, name: CategoryName.create(c.name) }));

  const opening = new Date('2025-11-01T12:00:00.000Z');
  await db.accounts.save(Account.create({ id: 'acc-itau', userId: EVAL_USER_ID, name: 'Itaú', kind: 'checking', openingBalance: Money.fromCents(500_000), openingBalanceDate: opening }));
  await db.accounts.save(Account.create({ id: 'acc-poupanca', userId: EVAL_USER_ID, name: 'Poupança', kind: 'savings', openingBalance: Money.fromCents(1_200_000), openingBalanceDate: opening }));
  await db.accounts.save(Account.create({ id: 'acc-carteira', userId: EVAL_USER_ID, name: 'Carteira', kind: 'wallet', openingBalance: Money.fromCents(30_000), openingBalanceDate: opening }));
  await db.accounts.save(Account.create({ id: 'card-nubank', userId: EVAL_USER_ID, name: 'Nubank', kind: 'credit-card', openingBalance: Money.zero(), creditLimit: Money.fromCents(800_000), closingDay: 5, dueDay: 12 }));
  await db.accounts.save(Account.create({ id: 'card-iti', userId: EVAL_USER_ID, name: 'Iti', kind: 'credit-card', openingBalance: Money.zero(), creditLimit: Money.fromCents(300_000), closingDay: 20, dueDay: 28 }));

  const random = seeded(20261015);
  let sequence = 0;
  for (const { year, month } of MONTHS) {
    const lastDay = month === 10 && year === 2026 ? 15 : 28;
    for (let day = 1; day <= lastDay; day += 1) {
      for (let k = 0; k < 2; k += 1) {
        const category = SPENDING[Math.floor(random() * SPENDING.length)] as (typeof SPENDING)[number];
        const account = SPENDING_ACCOUNTS[Math.floor(random() * SPENDING_ACCOUNTS.length)] as string;
        const cents = category.min + Math.floor(random() * (category.max - category.min));
        sequence += 1;
        await db.transactions.save(
          Transaction.create({
            id: `tx-${String(sequence).padStart(4, '0')}`,
            userId: EVAL_USER_ID,
            date: new Date(Date.UTC(year, month - 1, day, 12)),
            amount: Money.fromCents(cents),
            type: 'expense',
            categoryId: category.id,
            accountId: account,
            notes: `${category.name} ${day}/${month}`,
          }),
        );
      }
    }
    sequence += 1;
    await db.transactions.save(
      Transaction.create({
        id: `tx-${String(sequence).padStart(4, '0')}`,
        userId: EVAL_USER_ID,
        date: new Date(Date.UTC(year, month - 1, 5, 12)),
        amount: Money.fromCents(650_000),
        type: 'income',
        categoryId: 'cat-salario',
        accountId: 'acc-itau',
        notes: 'Salário',
      }),
    );
  }

  await db.incomes.save(
    Income.create({ id: 'inc-salario', userId: EVAL_USER_ID, date: new Date('2025-11-05T12:00:00.000Z'), amount: Money.fromCents(650_000), source: 'Salário', recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-10-05T12:00:00.000Z') }), categoryId: 'cat-salario', accountId: 'acc-itau' }),
  );
  for (const [id, description, due, cents] of [['fe-aluguel', 'Aluguel', 10, 180_000], ['fe-internet', 'Internet', 15, 12_000], ['fe-academia', 'Academia', 8, 9_000]] as const) {
    await db.fixedExpenses.save(FixedExpense.create({ id, userId: EVAL_USER_ID, dueDay: due, expectedAmount: Money.fromCents(cents), categoryId: 'cat-moradia', accountId: 'acc-itau', description }));
  }
  for (const [categoryId, cents] of [['cat-mercado', 120_000], ['cat-lazer', 40_000], ['cat-restaurantes', 60_000]] as const) {
    await container.setSpendingLimit.execute({ userId: EVAL_USER_ID, categoryId, period: { year: 2026, month: 10 }, maxAmountCents: cents });
  }
  // compras parceladas no cartao (o saldo comprometido e a fatura dependem delas)
  await container.recordInstallmentPurchase.execute({ userId: EVAL_USER_ID, accountId: 'card-nubank', amountCents: 240_000, installments: 6, date: '2026-09-20', categoryId: 'cat-lazer', notes: 'Notebook' });
  await container.recordInstallmentPurchase.execute({ userId: EVAL_USER_ID, accountId: 'card-iti', amountCents: 90_000, installments: 3, date: '2026-10-02', categoryId: 'cat-saude', notes: 'Óculos' });

  // 40 lancamentos sem categoria nos ultimos 6 meses (maio a out/2026), sendo 39 claros e 1 ambiguo ("PIX João") — spec 037, T002
  for (let i = 0; i < 40; i += 1) {
    const month = 5 + (i % 6);
    const day = 1 + ((i * 3) % (month === 10 ? 14 : 25));
    const entry = i === 39 ? { note: 'PIX João', cents: 15_000 } : (UNCATEGORIZED_NOTES[i % UNCATEGORIZED_NOTES.length] as (typeof UNCATEGORIZED_NOTES)[number]);
    const account = SPENDING_ACCOUNTS[i % SPENDING_ACCOUNTS.length] as string;
    await db.transactions.save(
      Transaction.create({
        id: `tx-uncat-${String(i + 1).padStart(2, '0')}`,
        userId: EVAL_USER_ID,
        date: new Date(Date.UTC(2026, month - 1, day, 12)),
        amount: Money.fromCents(entry.cents + (i % 7) * 100),
        type: 'expense',
        categoryId: 'cat-sem-categoria',
        accountId: account,
        notes: entry.note,
      }),
    );
  }

  return { db, container, clock, userId: EVAL_USER_ID };
}
