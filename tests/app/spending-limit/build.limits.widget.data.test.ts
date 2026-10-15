import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLimitsWidgetData } from '../../../src/app/spending-limit/build.limits.widget.data.ts';
import { buildLimitUsageRows } from '../../../src/app/spending-limit/build.limit.usage.rows.ts';
import { type SpendingLimitUsage } from '../../../src/app/spending-limit/list.spending.limits.with.usage.use.case.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Category } from '../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../src/domain/category/category.name.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

/** Montagem do widget de limites (spec 023, FR-001/FR-003/FR-005, SC-004/SC-005). */
const SEPT = Month.create({ year: 2026, month: 9 });
const categories = ['Combustivel', 'Alimentacao', 'Mercado', 'Lazer'].map((name) =>
  Category.create({ id: `c-${name.toLowerCase()}`, userId: 'u1', name: CategoryName.create(name) }),
);
const usage = (category: string, spent: number, month = SEPT): SpendingLimitUsage => ({
  limit: SpendingLimit.create({ id: `l-${category}`, userId: 'u1', categoryId: `c-${category}`, period: month, maxAmount: Money.fromCents(10_000) }),
  spent: Money.fromCents(spent),
  status: 'ok',
});
const card = (id: string, extra: { archived?: boolean } = {}) => {
  const account = Account.create({
    id,
    userId: 'u1',
    name: id.toUpperCase(),
    kind: 'credit-card',
    openingBalance: Money.zero(),
    creditLimit: Money.fromCents(100_000),
    closingDay: 5,
    dueDay: 12,
  });
  return { account: extra.archived === true ? account.archive() : account, availableCents: 60_000 };
};
const limits = [usage('mercado', 3_000), usage('combustivel', 3_200), usage('alimentacao', 14_300), usage('lazer', 3_000), usage('mercado', 9_000, Month.create({ year: 2026, month: 10 }))];
const cards = [card('iti'), card('nubank'), card('passai', { archived: true })];
const input = { month: SEPT, limits, categories, cards };

test('limites de gasto primeiro, do mais usado para o menos (empate por nome); so o mes', () => {
  const data = buildLimitsWidgetData({ ...input, preferences: { visibleCardIds: [], hiddenCategoryIds: [] } });
  assert.deepEqual(data.month, { year: 2026, month: 9 });
  assert.deepEqual(
    data.spendingLimits.map((row) => [row.name, row.usedPercent, row.status]),
    [['ALIMENTACAO', 143, 'over'], ['COMBUSTIVEL', 32, 'normal'], ['LAZER', 30, 'normal'], ['MERCADO', 30, 'normal']],
  );
  assert.deepEqual(data.cards, [], 'por padrao nenhum cartao');
});

test('limites escondidos ficam fora; so cartoes escolhidos, existentes e ativos', () => {
  const data = buildLimitsWidgetData({
    ...input,
    preferences: { visibleCardIds: ['nubank', 'passai', 'sumiu'], hiddenCategoryIds: ['c-mercado'] },
  });
  assert.ok(!data.spendingLimits.some((row) => row.name === 'MERCADO'));
  assert.deepEqual(data.cards.map((row) => [row.id, row.usedPercent]), [['nubank', 40]]);
});

test('mesmos percentuais que a tela Inicio para os mesmos dados (SC-005)', () => {
  const widget = buildLimitsWidgetData({ ...input, preferences: { visibleCardIds: ['iti', 'nubank'], hiddenCategoryIds: [] } });
  const home = new Map(buildLimitUsageRows(input).map((row) => [row.id, row.usedPercent]));
  for (const row of [...widget.spendingLimits, ...widget.cards]) assert.equal(row.usedPercent, home.get(row.id), row.name);
});
