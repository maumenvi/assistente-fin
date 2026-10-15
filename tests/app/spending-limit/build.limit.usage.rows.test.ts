import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLimitUsageRows } from '../../../src/app/spending-limit/build.limit.usage.rows.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

test('linhas de % usado: cartoes e limites do mes, sem valores absolutos (FR-045, FR-047)', () => {
  const september = Month.create({ year: 2026, month: 9 });
  const limit = (id: string, month: Month) =>
    SpendingLimit.create({ id, userId: 'u1', categoryId: 'c1', period: month, maxAmount: Money.fromCents(100_000) });
  const rows = buildLimitUsageRows({
    month: september,
    limits: [
      { limit: limit('l-set', september), spent: Money.fromCents(41_000), status: 'ok' },
      { limit: limit('l-out', Month.create({ year: 2026, month: 10 })), spent: Money.zero(), status: 'ok' },
    ],
    categories: [Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('Mercado') })],
    cards: [
      {
        account: Account.create({
          id: 'iti',
          userId: 'u1',
          name: 'Iti',
          kind: 'credit-card',
          openingBalance: Money.zero(),
          creditLimit: Money.fromCents(300_000),
          closingDay: 5,
          dueDay: 12,
        }),
        availableCents: 114_000,
      },
    ],
  });
  assert.deepEqual(rows, [
    { id: 'iti', name: 'Iti', kind: 'credit-card', usedPercent: 62, status: 'normal' },
    { id: 'l-set', name: 'MERCADO', kind: 'spending-limit', usedPercent: 41, status: 'normal' },
  ]);
  assert.ok(rows.every((row) => !('cents' in row)));
});
