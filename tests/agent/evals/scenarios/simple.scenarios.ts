import { accountBalance, brl, expenseTotal, fixedExpensesTotal, incomeTotal, limitStatus, monthRange, totalBalance, visibleCategoryCount } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

const MONTH_NAME: Readonly<Record<string, string>> = {
  '2025-12': 'dezembro de 2025', '2026-01': 'janeiro de 2026', '2026-03': 'março de 2026', '2026-06': 'junho de 2026',
  '2026-07': 'julho de 2026', '2026-08': 'agosto de 2026', '2026-09': 'setembro de 2026', '2026-10': 'outubro de 2026',
};

const SPENDING_CASES: readonly (readonly [string, string])[] = [
  ['Mercado', '2026-09'], ['Lazer', '2026-08'], ['Transporte', '2026-07'], ['Saúde', '2026-06'],
  ['Restaurantes', '2026-10'], ['Mercado', '2026-03'], ['Lazer', '2026-01'], ['Restaurantes', '2025-12'],
];

const spending: EvalScenario[] = SPENDING_CASES.map(([category, month]) => ({
  id: `simple.gasto.${category.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${month}`,
  category: 'simple',
  question: `Quanto gastei com ${category.toLowerCase()} em ${MONTH_NAME[month]}?`,
  calls: [{ name: 'query_transactions', args: { ...monthRange(month), category } }],
  figures: async (ds) => [brl(await expenseTotal(ds, { category, month }))],
  answer: ([total]) => `Em ${MONTH_NAME[month]} você gastou ${total} com ${category}.`,
}));

const ACCOUNTS: readonly (readonly [string, string])[] = [['acc-itau', 'Itaú'], ['acc-poupanca', 'Poupança'], ['acc-carteira', 'Carteira']];

const balances: EvalScenario[] = ACCOUNTS.map(([id, name]) => ({
  id: `simple.saldo.${id}`,
  category: 'simple',
  question: `Qual o saldo da conta ${name}?`,
  calls: [{ name: 'get_account_balances', args: { accountId: id } }],
  figures: async (ds) => [brl(await accountBalance(ds, id))],
  answer: ([balance]) => `O saldo da conta ${name} hoje é ${balance}.`,
}));

const LIMITS: readonly (readonly [string, string])[] = [['cat-mercado', 'mercado'], ['cat-lazer', 'lazer'], ['cat-restaurantes', 'restaurantes']];

const limits: EvalScenario[] = LIMITS.map(([id, name]) => ({
  id: `simple.limite.${id}`,
  category: 'simple',
  question: `Quanto ainda posso gastar com ${name} este mês, dentro do meu limite?`,
  calls: [{ name: 'get_spending_limits', args: { month: '2026-10' } }],
  figures: async (ds) => {
    const status = await limitStatus(ds, id);
    return [brl(status.remaining), `${status.percent}%`];
  },
  answer: ([remaining, percent]) => `Em outubro de 2026 restam ${remaining} no limite de ${name} (${percent} usado).`,
}));

export const SIMPLE_SCENARIOS: readonly EvalScenario[] = [
  ...spending,
  ...balances,
  {
    id: 'simple.saldo.total',
    category: 'simple',
    question: 'Qual o meu saldo disponível total hoje?',
    calls: [{ name: 'get_account_balances', args: {} }],
    figures: async (ds) => [brl(await totalBalance(ds))],
    answer: ([total]) => `Seu saldo disponível total hoje é ${total}.`,
  },
  ...limits,
  {
    id: 'simple.ganhos.2026-10',
    category: 'simple',
    question: 'Quanto vou receber de ganhos em outubro de 2026?',
    calls: [{ name: 'list_incomes', args: { month: '2026-10' } }],
    figures: async (ds) => [brl(await incomeTotal(ds, '2026-10'))],
    answer: ([total]) => `Em outubro de 2026 seus ganhos somam ${total}.`,
  },
  {
    id: 'simple.ganhos.2026-09',
    category: 'simple',
    question: 'Quanto recebi de ganhos em setembro de 2026?',
    calls: [{ name: 'list_incomes', args: { month: '2026-09' } }],
    figures: async (ds) => [brl(await incomeTotal(ds, '2026-09'))],
    answer: ([total]) => `Em setembro de 2026 seus ganhos somam ${total}.`,
  },
  {
    id: 'simple.fixos.total',
    category: 'simple',
    question: 'Qual o total dos meus gastos fixos por mês?',
    calls: [{ name: 'list_fixed_expenses', args: {} }],
    figures: async (ds) => [brl(await fixedExpensesTotal(ds))],
    answer: ([total]) => `Seus gastos fixos somam ${total} por mês.`,
  },
  {
    id: 'simple.categorias.quantidade',
    category: 'simple',
    question: 'Quantas categorias eu tenho cadastradas?',
    calls: [{ name: 'list_categories', args: {} }],
    figures: async (ds) => [`${await visibleCategoryCount(ds)} categorias`],
    answer: ([count]) => `Você tem ${count}.`,
  },
  {
    id: 'simple.gasto.total.2026-08',
    category: 'simple',
    question: 'Quanto gastei no total em agosto de 2026?',
    calls: [{ name: 'query_transactions', args: { ...monthRange('2026-08'), kind: 'expense' } }],
    figures: async (ds) => [brl(await expenseTotal(ds, { month: '2026-08' }))],
    answer: ([total]) => `Em agosto de 2026 você gastou ${total} no total.`,
  },
];
