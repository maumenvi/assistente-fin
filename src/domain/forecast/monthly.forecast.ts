import { Money } from '../shared/money.value.object.ts';
import { Month } from '../shared/month.value.object.ts';
import { type Income } from '../income/income.entity.ts';
import { type FixedExpense } from '../fixed-expense/fixed.expense.entity.ts';
import { type SpendingLimit } from '../spending-limit/spending.limit.entity.ts';
import { type Transaction } from '../transaction/transaction.entity.ts';
import { calculateLimitStatus, type LimitStatus } from '../spending-limit/limit.status.ts';
import { movingAverage } from './moving.average.ts';
import { categoryTrend } from './category.trend.ts';
import { recurrenceAppliesToMonth } from '../shared/recurrence.applies.to.month.ts';
import { type ForecastRule } from './forecast.rule.ts';

/** Janela padrao de media movel/tendencia por categoria, em meses (RF-19, configuravel). */
const DEFAULT_WINDOW_MONTHS = 3;

/** Tudo que `calculateMonthlyForecast` precisa ja carregado - nao busca nada sozinha (rule 8). */
export interface ForecastInputs {
  readonly month: Month;
  readonly incomes: readonly Income[];
  readonly fixedExpenses: readonly FixedExpense[];
  readonly spendingLimits: readonly SpendingLimit[];
  /** Transacoes `type: 'expense'` de meses anteriores a `month` (qualquer janela; so as
   *  ultimas `windowMonths` entram no calculo, o resto e ignorado). */
  readonly historicalExpenses: readonly Transaction[];
  /**
   * Transacoes ja materializadas cuja `date` cai DENTRO de `month` (spec 003, RF-31, decisao 6
   * do plano). So as de recorrencia (`seriesId != null`) contam: as de despesa substituem a
   * media movel da categoria (sabemos o valor, nao precisamos chutar); as de ganho entram no
   * `projectedIncome`. Ocorrencias avulsas (`seriesId === null`) sao ignoradas aqui - viram
   * historico no mes seguinte. Opcional: sem isso a previsao e 100% por media movel.
   */
  readonly monthTransactions?: readonly Transaction[] | undefined;
  readonly rules?: readonly ForecastRule[] | undefined;
  readonly windowMonths?: number | undefined;
  /**
   * Valores de fatura de cartao de credito ja calculados e atribuidos a `month` pelo
   * chamador (spec 008, RF-6) - esta funcao nao sabe o que e um cartao de credito (rule 10,
   * zero-dependencia do dominio); so soma o que recebeu. Opcional para nao quebrar quem
   * ainda nao passa esse dado (backward-compat).
   */
  readonly creditCardInvoices?: readonly Money[] | undefined;
  /**
   * Ids de categoria a excluir do calculo operacional (spec 016, RF-20) - transferencias
   * (`isSystemTransfer`) e pagamentos de fatura (`isSystemCardPayment`). Este modulo e
   * dominio puro (rule 10) e nao conhece `Category`; quem resolve o `Set` a partir das
   * flags e o caso de uso (`GetMonthlyForecastUseCase`), mesma filosofia de
   * `creditCardInvoices` (calculado fora, injetado dentro). Transacoes cujo `categoryId`
   * esta aqui nao entram em `historicalExpenses`/`recurringExpensesInMonth` de categoria
   * nenhuma, nem em `projectedIncome` - so em `projectedTransfers` (informativo).
   */
  readonly excludedCategoryIds?: ReadonlySet<string> | undefined;
}

/** Previsao de uma categoria de gasto nao-fixo dentro do mes (RF-19, CA-4, CA-18). */
export interface CategoryForecast {
  /** Id da categoria (spec 003, RF-10). Quem resolve o nome para exibir e a borda. */
  readonly categoryId: string;
  readonly movingAverage: Money;
  readonly trend: Money;
  /**
   * `max(0, movingAverage + trend)` - a nao ser que haja ocorrencias de recorrencia
   * materializadas no mes pra essa categoria: ai e a soma exata delas (spec 003, decisao 6).
   */
  readonly estimated: Money;
  /** `undefined` quando nao ha `SpendingLimit` definido pra essa categoria neste mes. */
  readonly limitStatus: LimitStatus | undefined;
}

/** Resultado da previsao do mes (spec 001, RF-7). */
export interface ForecastResult {
  readonly month: Month;
  readonly projectedIncome: Money;
  readonly projectedFixedExpenses: Money;
  readonly estimatedNonFixedExpenses: Money;
  readonly ruleAdjustments: Money;
  /** Soma de `creditCardInvoices` (spec 008, RF-6) - `Money.zero()` quando nao informado. */
  readonly projectedCreditCardInvoices: Money;
  /**
   * `projectedIncome - projectedFixedExpenses - estimatedNonFixedExpenses -
   * projectedCreditCardInvoices + ruleAdjustments`.
   */
  readonly projectedBalance: Money;
  readonly categories: readonly CategoryForecast[];
  /**
   * Soma das transacoes materializadas no mes cujo `categoryId` esta em
   * `excludedCategoryIds` (spec 016, RF-21) - transferencias internas e pagamentos de
   * fatura ja lancados no mes. Puramente informativo: NUNCA entra em `projectedBalance`
   * (ja excluido do calculo operacional por construcao). `Money.zero()` quando nao
   * informado ou sem nenhuma ocorrencia no mes.
   */
  readonly projectedTransfers: Money;
}

/**
 * Calcula a previsao adaptativa do mes (spec 001, RF-7, RF-19, CA-18) - funcao pura, sem
 * I/O; recalcular e so chamar de novo com dados atualizados (RF-8, CA-7, decisao 5 do
 * plano). Desenho completo documentado em plan.md (riscos, item 2).
 */
/**
 * Regra de exclusao (spec 018, RF-22/RF-26): alem da categoria ja promovida
 * (`excludedCategoryIds`, resolvida fora por quem monta `ForecastInputs`), tambem considera o
 * vinculo estrutural da propria transacao (`transferGroupId`/`cardPaymentGroupId`), sem este
 * modulo precisar conhecer `Category` (rule 10, zero-dependencia do dominio) - cobre uma
 * transferencia/pagamento cuja categoria ainda nao foi promovida mas cuja `Transaction` ja
 * tem o grupo preenchido (operacao nativa, spec 016, RF-3/RF-6). Usada tanto pelo calculo
 * principal quanto por `buildCategoryForecasts`, para as duas nunca divergirem.
 */
function isExcludedByGroupOrCategory(
  transaction: Transaction,
  excludedCategoryIds: ReadonlySet<string>,
): boolean {
  return (
    excludedCategoryIds.has(transaction.categoryId) ||
    transaction.transferGroupId !== null ||
    transaction.cardPaymentGroupId !== null
  );
}

export function calculateMonthlyForecast(inputs: ForecastInputs): ForecastResult {
  const windowMonths = inputs.windowMonths ?? DEFAULT_WINDOW_MONTHS;
  const excludedCategoryIds = inputs.excludedCategoryIds ?? new Set<string>();
  const isExcluded = (transaction: Transaction) =>
    isExcludedByGroupOrCategory(transaction, excludedCategoryIds);

  const transactionsInMonthAll = (inputs.monthTransactions ?? []).filter((transaction) =>
    Month.fromDate(transaction.date).equals(inputs.month),
  );
  // transferencias/pagamentos de fatura materializados no mes (RF-21) - so informativo,
  // nunca entram no resultado operacional abaixo (RF-20).
  const projectedTransfers = sumMoney(
    transactionsInMonthAll.filter(isExcluded).map((transaction) => transaction.amount),
  );
  const transactionsInMonth = transactionsInMonthAll.filter((transaction) => !isExcluded(transaction));
  const recurringInMonth = transactionsInMonth.filter((transaction) => transaction.seriesId !== null);

  // Income com Transaction ja lancada no mes (spec 012, RF-3/RF-5/RF-11, Q2): o lancamento
  // avulso (com ou sem seriesId - RF-3 nunca tem seriesId, RF-5 pode ter) e a fonte de
  // verdade daquele mes, entao o Income para de contar pela via analitica (recurrenceAppliesToMonth)
  // so nesse mes especifico - meses ainda nao lancados continuam projetados normalmente.
  const launchedIncomeIds = new Set(
    transactionsInMonth
      .filter((transaction) => transaction.type === 'income' && transaction.incomeId !== null)
      .map((transaction) => transaction.incomeId),
  );

  const projectedIncome = sumMoney(
    inputs.incomes
      .filter((income) => !launchedIncomeIds.has(income.id))
      .filter((income) =>
        recurrenceAppliesToMonth(income.recurrence, Month.fromDate(income.date), inputs.month),
      )
      .map((income) => income.amount),
  ).add(
    // todo ganho ja lancado no mes conta pelo valor real da Transaction (spec 003, decisao 6;
    // spec 012, RF-3/RF-5/RF-11) - inclui tanto ocorrencias de serie quanto lancamentos avulsos.
    sumMoney(transactionsInMonth.filter((t) => t.type === 'income').map((t) => t.amount)),
  );

  // FixedExpense nao tem data-ancora (achado documentado no plano) - todo gasto fixo
  // cadastrado se aplica a todo mes projetado, independente da recorrencia.
  const projectedFixedExpenses = sumMoney(
    inputs.fixedExpenses.map((expense) => expense.expectedAmount),
  );

  const recurringExpensesInMonth = recurringInMonth.filter((t) => t.type === 'expense');
  const categories = buildCategoryForecasts(inputs, windowMonths, recurringExpensesInMonth);
  const estimatedNonFixedExpenses = sumMoney(categories.map((category) => category.estimated));

  const ruleAdjustments = sumMoney(
    (inputs.rules ?? []).map((rule) => Money.fromCents(rule.adjustmentCents)),
  );

  const projectedCreditCardInvoices = sumMoney(inputs.creditCardInvoices ?? []);

  const projectedBalance = projectedIncome
    .subtract(projectedFixedExpenses)
    .subtract(estimatedNonFixedExpenses)
    .subtract(projectedCreditCardInvoices)
    .add(ruleAdjustments);

  return {
    month: inputs.month,
    projectedIncome,
    projectedFixedExpenses,
    estimatedNonFixedExpenses,
    ruleAdjustments,
    projectedCreditCardInvoices,
    projectedBalance,
    categories,
    projectedTransfers,
  };
}

function buildCategoryForecasts(
  inputs: ForecastInputs,
  windowMonths: number,
  recurringExpensesInMonth: readonly Transaction[],
): CategoryForecast[] {
  const excludedCategoryIds = inputs.excludedCategoryIds ?? new Set<string>();
  const expenses = inputs.historicalExpenses.filter(
    (transaction) => !isExcludedByGroupOrCategory(transaction, excludedCategoryIds),
  );
  // categorias vistas no historico OU com ocorrencia de recorrencia ja materializada no mes
  const categoryIds = [
    ...new Set([
      ...expenses.map((transaction) => transaction.categoryId),
      ...recurringExpensesInMonth.map((transaction) => transaction.categoryId),
    ]),
  ].sort();
  const window = buildWindowMonths(inputs.month, windowMonths);

  return categoryIds.map((categoryId) => {
    const series = window.map((month) =>
      sumCents(
        expenses.filter(
          (transaction) =>
            transaction.categoryId === categoryId && Month.fromDate(transaction.date).equals(month),
        ),
      ),
    );

    const averageCents = movingAverage(series);
    const trendCents = categoryTrend(series);

    // ocorrencias de recorrencia ja materializadas no mes pra essa categoria: sao valor certo,
    // substituem o chute por media movel (spec 003, decisao 6, RF-31)
    const materializedInMonth = recurringExpensesInMonth.filter(
      (transaction) => transaction.categoryId === categoryId,
    );
    const estimatedCents =
      materializedInMonth.length > 0
        ? sumCents(materializedInMonth)
        : Math.max(0, averageCents + trendCents);
    const estimated = Money.fromCents(estimatedCents);

    // casa por id: renomear a categoria nao desfaz o vinculo limite <-> gasto (CA-24)
    const limit = inputs.spendingLimits.find(
      (spendingLimit) =>
        spendingLimit.categoryId === categoryId && spendingLimit.period.equals(inputs.month),
    );

    return {
      categoryId,
      movingAverage: Money.fromCents(averageCents),
      trend: Money.fromCents(trendCents),
      estimated,
      limitStatus: limit ? calculateLimitStatus(limit.maxAmount, estimated) : undefined,
    };
  });
}

/** Os `windowMonths` meses imediatamente antes de `month`, do mais antigo pro mais recente. */
function buildWindowMonths(month: Month, windowMonths: number): Month[] {
  const months: Month[] = [];
  let cursor = month;
  for (let i = 0; i < windowMonths; i += 1) {
    cursor = cursor.previous();
    months.unshift(cursor);
  }
  return months;
}

function sumCents(transactions: readonly Transaction[]): number {
  return transactions.reduce((total, transaction) => total + transaction.amount.cents, 0);
}

function sumMoney(values: readonly Money[]): Money {
  return values.reduce((total, value) => total.add(value), Money.zero());
}
