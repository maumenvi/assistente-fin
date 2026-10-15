import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthlyForecast } from '../../../src/domain/forecast/monthly.forecast.ts';
import { Income } from '../../../src/domain/income/income.entity.ts';
import { FixedExpense } from '../../../src/domain/fixed-expense/fixed.expense.entity.ts';
import { SpendingLimit } from '../../../src/domain/spending-limit/spending.limit.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { Recurrence } from '../../../src/domain/shared/recurrence.value.object.ts';
import { Month } from '../../../src/domain/shared/month.value.object.ts';

const TARGET_MONTH = Month.create({ year: 2026, month: 4 }); // abril/2026

const income = (id: string, dateIso: string, cents: number, kind: 'none' | 'monthly'): Income =>
  Income.create({
    id,
    userId: 'u1',
    date: new Date(dateIso),
    amount: Money.fromCents(cents),
    source: 'Salario',
    recurrence:
      kind === 'none'
        ? Recurrence.none()
        : Recurrence.create({
            frequency: 'mensal',
            endDate: new Date(new Date(dateIso).getTime() + 300 * 86_400_000),
          }),
    categoryId: 'Trabalho',
  });

const fixedExpense = (id: string, cents: number): FixedExpense =>
  FixedExpense.create({
    id,
    userId: 'u1',
    dueDay: 10,
    expectedAmount: Money.fromCents(cents),
    categoryId: 'Moradia',
    accountId: 'acc1',
  });

const expenseTx = (
  id: string,
  dateIso: string,
  cents: number,
  categoryId = 'cat-1',
): Transaction =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(dateIso),
    amount: Money.fromCents(cents),
    type: 'expense',
    categoryId,
    accountId: 'acc1',
  });

const seriesTx = (
  id: string,
  dateIso: string,
  cents: number,
  categoryId: string,
  type: 'expense' | 'income' = 'expense',
): Transaction =>
  Transaction.create({
    id,
    userId: 'u1',
    date: new Date(dateIso),
    amount: Money.fromCents(cents),
    type,
    categoryId,
    accountId: 'acc1',
    seriesId: 'series-1',
  });

const limit = (id: string, categoryId: string, cents: number): SpendingLimit =>
  SpendingLimit.create({
    id,
    userId: 'u1',
    categoryId,
    period: TARGET_MONTH,
    maxAmount: Money.fromCents(cents),
  });

test('previsao vazia (sem historico/ganhos/gastos) devolve tudo zerado', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
  });

  assert.equal(result.projectedIncome.cents, 0);
  assert.equal(result.projectedFixedExpenses.cents, 0);
  assert.equal(result.estimatedNonFixedExpenses.cents, 0);
  assert.equal(result.projectedBalance.cents, 0);
  assert.deepEqual(result.categories, []);
});

test('projeta ganhos que se aplicam ao mes (recurrence) e ignora os que nao se aplicam (RF-2, RF-19)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [
      income('i1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly'), // aplica (mensal, ancora antes)
      income('i2', '2026-02-10T00:00:00.000Z', 100_000, 'none'), // nao aplica (unico, mes diferente)
    ],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
  });

  assert.equal(result.projectedIncome.cents, 500_000);
});

test('ganho recorrente nao e projetado depois da data final da recorrencia (spec 003, CA-23)', () => {
  const salary = Income.create({
    id: 'i1',
    userId: 'u1',
    date: new Date('2026-01-05T00:00:00.000Z'),
    amount: Money.fromCents(500_000),
    source: 'Salario',
    // termina em fevereiro/2026 - nao alcanca o mes-alvo (abril/2026)
    recurrence: Recurrence.create({ frequency: 'mensal', endDate: new Date('2026-02-28T00:00:00.000Z') }),
    categoryId: 'Trabalho',
  });

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [salary],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
  });

  assert.equal(result.projectedIncome.cents, 0);
});

test('soma todo FixedExpense cadastrado, independente da recorrencia (achado do plano)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [fixedExpense('fe1', 150_000), fixedExpense('fe2', 20_000)],
    spendingLimits: [],
    historicalExpenses: [],
  });

  assert.equal(result.projectedFixedExpenses.cents, 170_000);
});

test('media movel + tendencia por categoria, com status de limite (RF-19, CA-4, CA-18)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [limit('sl1', 'cat-mercado', 45_000)],
    historicalExpenses: [
      expenseTx('t1', '2026-01-15T00:00:00.000Z', 30_000, 'cat-mercado'),
      expenseTx('t2', '2026-02-15T00:00:00.000Z', 40_000, 'cat-mercado'),
      expenseTx('t3', '2026-03-15T00:00:00.000Z', 50_000, 'cat-mercado'),
      expenseTx('t4', '2026-04-01T00:00:00.000Z', 999_999, 'cat-mercado'), // no mes alvo, fora da janela historica
    ],
  });

  assert.equal(result.categories.length, 1);
  const [mercado] = result.categories;
  assert.equal(mercado?.categoryId, 'cat-mercado');
  assert.equal(mercado?.movingAverage.cents, 40_000); // (30000+40000+50000)/3
  assert.equal(mercado?.trend.cents, 10_000); // deltas +10000, +10000
  assert.equal(mercado?.estimated.cents, 50_000); // 40000 + 10000
  assert.equal(mercado?.limitStatus, 'exceeded'); // 50000 > 45000
  assert.equal(result.estimatedNonFixedExpenses.cents, 50_000);
});

test('categoria sem limite definido devolve limitStatus undefined', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [expenseTx('t1', '2026-03-15T00:00:00.000Z', 10_000, 'Lazer')],
  });

  assert.equal(result.categories[0]?.limitStatus, undefined);
});

test('estimated nunca fica negativo mesmo com tendencia de queda forte', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [
      expenseTx('t1', '2026-01-15T00:00:00.000Z', 10_000, 'Lazer'),
      expenseTx('t2', '2026-02-15T00:00:00.000Z', 100, 'Lazer'),
      expenseTx('t3', '2026-03-15T00:00:00.000Z', 1, 'Lazer'),
    ],
  });

  // media (10000+100+1)/3=3367; tendencia media dos deltas (-9900,-99)/2=-4999.5->-4999;
  // 3367-4999 = -1632 -> nunca negativo
  assert.equal(result.categories[0]?.estimated.cents, 0);
});

test('ruleAdjustments (RF-19) entra no saldo projetado', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [income('i1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly')],
    fixedExpenses: [fixedExpense('fe1', 150_000)],
    spendingLimits: [],
    historicalExpenses: [
      expenseTx('t1', '2026-01-15T00:00:00.000Z', 30_000, 'Mercado'),
      expenseTx('t2', '2026-02-15T00:00:00.000Z', 40_000, 'Mercado'),
      expenseTx('t3', '2026-03-15T00:00:00.000Z', 50_000, 'Mercado'),
    ],
    rules: [{ categoryId: 'Mercado', adjustmentCents: -5_000 }],
  });

  assert.equal(result.ruleAdjustments.cents, -5_000);
  // 500000 - 150000 - 50000 + (-5000)
  assert.equal(result.projectedBalance.cents, 295_000);
});

test('ocorrencia de recorrencia materializada no mes substitui a media movel da categoria (decisao 6)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [limit('l1', 'Assinatura', 100_000)],
    // historico chutaria ~30000/mes pra Assinatura
    historicalExpenses: [
      expenseTx('h1', '2026-01-15T00:00:00.000Z', 30_000, 'Assinatura'),
      expenseTx('h2', '2026-02-15T00:00:00.000Z', 30_000, 'Assinatura'),
      expenseTx('h3', '2026-03-15T00:00:00.000Z', 30_000, 'Assinatura'),
    ],
    // mas ja existe a ocorrencia de abril, valor certo = 25000
    monthTransactions: [seriesTx('occ-abr', '2026-04-10T00:00:00.000Z', 25_000, 'Assinatura')],
  });

  const assinatura = result.categories.find((c) => c.categoryId === 'Assinatura');
  assert.equal(assinatura?.movingAverage.cents, 30_000, 'a media movel ainda e reportada');
  assert.equal(assinatura?.estimated.cents, 25_000, 'mas o estimado usa a ocorrencia real');
  assert.equal(result.estimatedNonFixedExpenses.cents, 25_000);
});

test('categoria so com ocorrencia materializada (sem historico) aparece na previsao', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions: [seriesTx('occ', '2026-04-10T00:00:00.000Z', 12_300, 'Streaming')],
  });

  const streaming = result.categories.find((c) => c.categoryId === 'Streaming');
  assert.equal(streaming?.estimated.cents, 12_300);
});

test('ganho recorrente materializado no mes entra no projectedIncome (RF-31)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions: [seriesTx('occ-inc', '2026-04-05T00:00:00.000Z', 400_000, 'Trabalho', 'income')],
  });

  assert.equal(result.projectedIncome.cents, 400_000);
});

test('Income com Transaction ja lancada no mes conta 1x, nao 2x (spec 012, RF-11)', () => {
  const salary = income('income-1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly');
  const launched = seriesTx('tx-launch', '2026-04-05T00:00:00.000Z', 500_000, 'Trabalho', 'income');
  const launchedWithIncomeId = Transaction.fromPersistence({
    id: launched.id,
    userId: launched.userId,
    date: launched.date,
    amount: launched.amount,
    type: launched.type,
    categoryId: launched.categoryId,
    accountId: launched.accountId,
    incomeId: 'income-1',
  });

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [salary],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions: [launchedWithIncomeId],
  });

  assert.equal(result.projectedIncome.cents, 500_000, 'conta 1x (o valor da Transaction lancada), nao 2x');
});

test('Income recorrente sem lancamento ainda no mes conta pela via analitica (spec 012, RF-11)', () => {
  const salary = income('income-1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly');

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [salary],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions: [],
  });

  assert.equal(result.projectedIncome.cents, 500_000, 'sem Transaction lancada, projeta via analitica');
});

test('Income sem accountId (sem incomeId em nenhuma Transaction) permanece inalterado (spec 012, RF-11)', () => {
  const salary = income('income-1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly');
  const unrelated = seriesTx('tx-outro', '2026-04-05T00:00:00.000Z', 300_000, 'Trabalho', 'income');

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [salary],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions: [unrelated],
  });

  // unrelated nao tem incomeId -> nao exclui 'income-1' da via analitica; ambos contam
  assert.equal(result.projectedIncome.cents, 800_000);
});

test('ocorrencia avulsa (seriesId null) no mes NAO substitui a media movel', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [
      expenseTx('h1', '2026-01-15T00:00:00.000Z', 30_000, 'Mercado'),
      expenseTx('h2', '2026-02-15T00:00:00.000Z', 30_000, 'Mercado'),
      expenseTx('h3', '2026-03-15T00:00:00.000Z', 30_000, 'Mercado'),
    ],
    monthTransactions: [expenseTx('avulso', '2026-04-10T00:00:00.000Z', 999_999, 'Mercado')],
  });

  const mercado = result.categories.find((c) => c.categoryId === 'Mercado');
  assert.equal(mercado?.estimated.cents, 30_000, 'segue a media movel');
});

test('creditCardInvoices soma em projectedCreditCardInvoices e reflete em projectedBalance (spec 008, RF-6)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [income('i1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly')],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    creditCardInvoices: [Money.fromCents(80_000), Money.fromCents(20_000)],
  });

  assert.equal(result.projectedCreditCardInvoices.cents, 100_000);
  // 500000 - 0 (fixed) - 0 (nonfixed) - 100000 (cartao) + 0 (rules)
  assert.equal(result.projectedBalance.cents, 400_000);
});

test('ausencia de creditCardInvoices nao quebra o calculo (backward-compat)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [income('i1', '2026-01-05T00:00:00.000Z', 500_000, 'monthly')],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
  });

  assert.equal(result.projectedCreditCardInvoices.cents, 0);
  assert.equal(result.projectedBalance.cents, 500_000);
});

test('windowMonths configuravel (default 3, mas o chamador pode escolher)', () => {
  const historicalExpenses = [
    expenseTx('t1', '2025-12-15T00:00:00.000Z', 100_000, 'Mercado'), // fora da janela de 1 mes
    expenseTx('t2', '2026-03-15T00:00:00.000Z', 20_000, 'Mercado'),
  ];

  const withDefaultWindow = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses,
  });
  // janela default (3 meses: jan/fev/mar) inclui so 'mar' com dado -> media (0+0+20000)/3
  assert.equal(withDefaultWindow.categories[0]?.movingAverage.cents, 6_667);

  const withWindow1 = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses,
    windowMonths: 1,
  });
  // janela de 1 mes (so marco) -> media = 20000
  assert.equal(withWindow1.categories[0]?.movingAverage.cents, 20_000);
});

test('excludedCategoryIds: transacao historica da categoria excluida nao entra na media/tendencia nem em estimatedNonFixedExpenses (spec 016, RF-20)', () => {
  const historicalExpenses = [
    expenseTx('t1', '2026-02-15T00:00:00.000Z', 60_000, 'cat-transfer'),
    expenseTx('t2', '2026-03-15T00:00:00.000Z', 60_000, 'cat-transfer'),
    expenseTx('t3', '2026-03-15T00:00:00.000Z', 5_000, 'cat-mercado'),
  ];

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses,
    excludedCategoryIds: new Set(['cat-transfer']),
  });

  // so a categoria 'cat-mercado' sobrevive - 'cat-transfer' nunca aparece nas previsoes por categoria
  assert.deepEqual(result.categories.map((c) => c.categoryId), ['cat-mercado']);
  assert.ok(result.estimatedNonFixedExpenses.cents < 60_000, 'nao deve ter herdado a media da transferencia');
});

test('excludedCategoryIds: transferencia/pagamento materializado no mes aparece em projectedTransfers, nunca em projectedBalance (spec 016, RF-21)', () => {
  const monthTransactions = [
    seriesTx('t1', '2026-04-05T00:00:00.000Z', 60_000, 'cat-transfer', 'expense'),
    seriesTx('t2', '2026-04-05T00:00:00.000Z', 10_000, 'cat-mercado', 'expense'),
  ];

  const withoutExclusion = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions,
  });
  const withExclusion = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions,
    excludedCategoryIds: new Set(['cat-transfer']),
  });

  assert.equal(withExclusion.projectedTransfers.cents, 60_000);
  // sem exclusao, a categoria de transferencia materializada entraria normalmente no calculo
  assert.ok(withoutExclusion.estimatedNonFixedExpenses.cents > withExclusion.estimatedNonFixedExpenses.cents);
  assert.equal(withExclusion.estimatedNonFixedExpenses.cents, 10_000, 'so a categoria real (cat-mercado) resta');
});

test('transferGroupId preenchido exclui a transacao mesmo com categoria NAO em excludedCategoryIds (spec 018, RF-22/RF-26)', () => {
  const monthTransactions = [
    Transaction.create({
      id: 't-transfer-out',
      userId: 'u1',
      date: new Date('2026-04-05T00:00:00.000Z'),
      amount: Money.fromCents(60_000),
      type: 'expense',
      categoryId: 'cat-transfer-nao-promovida',
      accountId: 'acc1',
      transferGroupId: 'transfer-1',
    }),
  ];

  // excludedCategoryIds NAO contem 'cat-transfer-nao-promovida' - simula transferencia ja
  // criada pela operacao nativa (transferGroupId preenchido) cuja categoria ainda nao foi
  // promovida a isSystemTransfer (a promocao so acontece sob demanda, spec 016/018).
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions,
  });

  assert.equal(result.projectedTransfers.cents, 60_000);
  assert.equal(result.estimatedNonFixedExpenses.cents, 0, 'a transferencia nao deveria virar estimativa de categoria');
  assert.equal(
    result.categories.find((c) => c.categoryId === 'cat-transfer-nao-promovida'),
    undefined,
  );
});

test('cardPaymentGroupId preenchido exclui a transacao mesmo com categoria NAO em excludedCategoryIds (spec 018, RF-22/RF-26)', () => {
  const monthTransactions = [
    Transaction.create({
      id: 't-payment',
      userId: 'u1',
      date: new Date('2026-04-05T00:00:00.000Z'),
      amount: Money.fromCents(45_000),
      type: 'expense',
      categoryId: 'cat-payment-nao-promovida',
      accountId: 'acc1',
      cardPaymentGroupId: 'payment-1',
    }),
  ];

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
    monthTransactions,
  });

  assert.equal(result.projectedTransfers.cents, 45_000);
  assert.equal(result.estimatedNonFixedExpenses.cents, 0);
});

test('transferGroupId preenchido no historico exclui da media movel de categoria (spec 018, RF-26 - buildCategoryForecasts)', () => {
  const historicalExpenses = [
    Transaction.create({
      id: 't-transfer-hist',
      userId: 'u1',
      date: new Date('2026-03-15T00:00:00.000Z'),
      amount: Money.fromCents(60_000),
      type: 'expense',
      categoryId: 'cat-transfer-nao-promovida',
      accountId: 'acc1',
      transferGroupId: 'transfer-1',
    }),
    Transaction.create({
      id: 't-mercado-hist',
      userId: 'u1',
      date: new Date('2026-03-15T00:00:00.000Z'),
      amount: Money.fromCents(5_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'acc1',
    }),
  ];

  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses,
  });

  assert.deepEqual(result.categories.map((c) => c.categoryId), ['cat-mercado']);
});

test('ausencia de excludedCategoryIds/monthTransactions -> projectedTransfers zero (backward-compat)', () => {
  const result = calculateMonthlyForecast({
    month: TARGET_MONTH,
    incomes: [],
    fixedExpenses: [],
    spendingLimits: [],
    historicalExpenses: [],
  });

  assert.equal(result.projectedTransfers.cents, 0);
});
