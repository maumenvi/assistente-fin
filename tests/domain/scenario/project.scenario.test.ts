import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectScenario } from '../../../src/domain/scenario/project.scenario.ts';
import { ScenarioAdjustment } from '../../../src/domain/scenario/scenario.adjustment.ts';
import { calculateMonthlyForecast } from '../../../src/domain/forecast/monthly.forecast.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const salary = Income.create({
  id: 'inc-1',
  userId: 'u1',
  date: new Date('2026-03-01T00:00:00.000Z'),
  amount: Money.fromCents(500_000),
  source: 'Salario',
  recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2027-03-01T00:00:00.000Z') }),
  categoryId: 'Trabalho',
});

const rent = FixedExpense.create({
  id: 'fx-1',
  userId: 'u1',
  dueDay: 10,
  expectedAmount: Money.fromCents(180_000),
  categoryId: 'Moradia',
  accountId: 'acc1',
});

const baseInputs = {
  incomes: [salary],
  fixedExpenses: [rent],
  spendingLimits: [],
  historicalExpenses: [],
};

const monthsFrom = (start: Month, count: number): Month[] => {
  const months: Month[] = [];
  let cursor = start;
  for (let i = 0; i < count; i += 1) {
    months.push(cursor);
    cursor = cursor.next();
  }
  return months;
};

const march = Month.create({ year: 2026, month: 3 });

test('sem ajustes: cada mes bate com calculateMonthlyForecast e delta zero', () => {
  const months = monthsFrom(march, 3);
  const projection = projectScenario({ baseInputs, adjustments: [], months });

  assert.equal(projection.months.length, 3);
  for (const projected of projection.months) {
    const baseline = calculateMonthlyForecast({ ...baseInputs, month: projected.month });
    assert.equal(projected.baselineBalanceCents, baseline.projectedBalance.cents);
    assert.equal(projected.scenarioBalanceCents, baseline.projectedBalance.cents);
    assert.equal(projected.incomeDeltaCents, 0);
    assert.equal(projected.expenseDeltaCents, 0);
  }
});

test('add income so incide nos meses do intervalo', () => {
  const adjustment = ScenarioAdjustment.create({
    target: 'income',
    mode: 'add',
    label: 'Bico',
    amountCents: 100_000,
    from: Month.create({ year: 2026, month: 4 }),
    to: Month.create({ year: 2026, month: 5 }),
  });
  const months = monthsFrom(march, 4); // mar, abr, mai, jun
  const projection = projectScenario({ baseInputs, adjustments: [adjustment], months });

  assert.equal(projection.months[0]?.incomeDeltaCents, 0); // marco
  assert.equal(projection.months[1]?.incomeDeltaCents, 100_000); // abril
  assert.equal(projection.months[2]?.incomeDeltaCents, 100_000); // maio
  assert.equal(projection.months[3]?.incomeDeltaCents, 0); // junho

  const abril = projection.months[1]!;
  assert.equal(abril.scenarioBalanceCents, abril.baselineBalanceCents + 100_000);
});

test('add expense negativo (reducao) sobe o saldo do cenario', () => {
  const adjustment = ScenarioAdjustment.create({
    target: 'expense',
    mode: 'add',
    label: 'Sem aluguel',
    amountCents: -180_000,
    from: march,
    to: march,
  });
  const projection = projectScenario({ baseInputs, adjustments: [adjustment], months: [march] });

  const only = projection.months[0]!;
  assert.equal(only.expenseDeltaCents, -180_000);
  assert.equal(only.scenarioBalanceCents, only.baselineBalanceCents + 180_000);
});

test('replace income troca o valor mensal do alvo no intervalo', () => {
  const adjustment = ScenarioAdjustment.create({
    target: 'income',
    mode: 'replace',
    label: 'Salario reduzido',
    amountCents: 300_000,
    from: march,
    to: march,
  });
  const projection = projectScenario({ baseInputs, adjustments: [adjustment], months: [march] });

  // baseline income 500_000 -> 300_000 => delta -200_000
  assert.equal(projection.months[0]?.incomeDeltaCents, -200_000);
});

test('clamp: reducao nao leva o alvo abaixo de zero', () => {
  const adjustment = ScenarioAdjustment.create({
    target: 'income',
    mode: 'add',
    label: 'Corte gigante',
    amountCents: -900_000,
    from: march,
    to: march,
  });
  const projection = projectScenario({ baseInputs, adjustments: [adjustment], months: [march] });

  // income vai a 0, nao a -400_000 => delta -500_000
  assert.equal(projection.months[0]?.incomeDeltaCents, -500_000);
});

test('replace antes de add quando os dois incidem no mesmo mes', () => {
  const replace = ScenarioAdjustment.create({
    target: 'income',
    mode: 'replace',
    label: 'Base nova',
    amountCents: 400_000,
    from: march,
    to: march,
  });
  const add = ScenarioAdjustment.create({
    target: 'income',
    mode: 'add',
    label: 'Extra',
    amountCents: 50_000,
    from: march,
    to: march,
  });
  const projection = projectScenario({
    baseInputs,
    adjustments: [replace, add],
    months: [march],
  });

  // 400_000 (replace) + 50_000 (add) = 450_000; baseline 500_000 => delta -50_000
  assert.equal(projection.months[0]?.incomeDeltaCents, -50_000);
});

test('respeita o tamanho do horizonte (lista de meses)', () => {
  const projection = projectScenario({ baseInputs, adjustments: [], months: monthsFrom(march, 12) });
  assert.equal(projection.months.length, 12);
  assert.equal(projection.months[11]?.month.toString(), '2027-02');
});
