import { accountBalance, brl, cardStatus, expenseTotal, limitStatus, monthRange, monthSummary } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

const SUMMARY_MONTHS: readonly (readonly [string, string])[] = [['2026-09', 'setembro'], ['2026-08', 'agosto'], ['2026-07', 'julho'], ['2026-10', 'outubro']];

const summaries: EvalScenario[] = SUMMARY_MONTHS.map(([month, name]) => ({
  id: `composite.resumo.${month}`,
  category: 'composite',
  question: `Faça um resumo de ${name} de 2026: receitas, despesas e resultado.`,
  calls: [{ name: 'get_month_summary', args: { month } }],
  figures: async (ds) => {
    const s = await monthSummary(ds, month);
    return [brl(s.income), brl(s.expense), brl(s.balance)];
  },
  answer: ([income, expense, balance]) => `Em ${name} de 2026: receitas ${income}, despesas ${expense} e resultado ${balance}.`,
}));

const PAIRS: readonly (readonly [string, string, string])[] = [
  ['Mercado', 'Lazer', '2026-09'], ['Transporte', 'Saúde', '2026-08'], ['Mercado', 'Restaurantes', '2026-07'],
];

const pairs: EvalScenario[] = PAIRS.map(([a, b, month]) => ({
  id: `composite.duas.categorias.${month}.${a.toLowerCase()}.${b.toLowerCase()}`.replace(/[^a-z0-9.-]/g, ''),
  category: 'composite',
  question: `Compare o que gastei com ${a.toLowerCase()} e com ${b.toLowerCase()} em ${month.slice(5)}/${month.slice(0, 4)}.`,
  calls: [
    { name: 'query_transactions', args: { ...monthRange(month), category: a } },
    { name: 'query_transactions', args: { ...monthRange(month), category: b } },
  ],
  figures: async (ds) => [brl(await expenseTotal(ds, { category: a, month })), brl(await expenseTotal(ds, { category: b, month }))],
  answer: ([first, second]) => `Em ${month.slice(5)}/${month.slice(0, 4)}: ${a} ${first} e ${b} ${second}.`,
}));

export const COMPOSITE_SCENARIOS: readonly EvalScenario[] = [
  ...summaries,
  ...pairs,
  {
    id: 'composite.saldo.e.limite',
    category: 'composite',
    question: 'Quanto tenho no Itaú e quanto resta do limite de mercado este mês?',
    calls: [
      { name: 'get_account_balances', args: { accountId: 'acc-itau' } },
      { name: 'get_spending_limits', args: { month: '2026-10' } },
    ],
    figures: async (ds) => [brl(await accountBalance(ds, 'acc-itau')), brl((await limitStatus(ds, 'cat-mercado')).remaining)],
    answer: ([balance, remaining]) => `No Itaú você tem ${balance} e restam ${remaining} do limite de mercado.`,
  },
  {
    id: 'composite.poupanca.e.carteira',
    category: 'composite',
    question: 'Quanto tenho na poupança e quanto tenho na carteira?',
    calls: [
      { name: 'get_account_balances', args: { accountId: 'acc-poupanca' } },
      { name: 'get_account_balances', args: { accountId: 'acc-carteira' } },
    ],
    figures: async (ds) => [brl(await accountBalance(ds, 'acc-poupanca')), brl(await accountBalance(ds, 'acc-carteira'))],
    answer: ([savings, wallet]) => `Na poupança você tem ${savings} e na carteira ${wallet}.`,
  },
  {
    id: 'composite.gastos.e.ganhos.setembro',
    category: 'composite',
    question: 'Em setembro de 2026, quanto entrou e quanto saiu nos lançamentos?',
    calls: [{ name: 'query_transactions', args: monthRange('2026-09') }],
    figures: async (ds) => [brl(await expenseTotal(ds, { month: '2026-09' }))],
    answer: ([spent]) => `Em setembro de 2026 saíram ${spent} nos lançamentos.`,
  },
  {
    id: 'composite.restaurantes.lazer.outubro',
    category: 'composite',
    question: 'Quanto gastei com restaurantes e lazer neste mês e como estão meus limites?',
    calls: [
      { name: 'query_transactions', args: { ...monthRange('2026-10'), category: 'Restaurantes' } },
      { name: 'get_spending_limits', args: { month: '2026-10' } },
    ],
    figures: async (ds) => [brl(await expenseTotal(ds, { category: 'Restaurantes', month: '2026-10' })), `${(await limitStatus(ds, 'cat-restaurantes')).percent}%`],
    answer: ([spent, percent]) => `Com restaurantes você gastou ${spent} neste mês, ${percent} do limite.`,
  },
  {
    id: 'composite.saldo.e.fatura',
    category: 'composite',
    question: 'Quanto tenho no Itaú e quanto está a fatura do cartão Nubank?',
    calls: [
      { name: 'get_account_balances', args: { accountId: 'acc-itau' } },
      { name: 'get_credit_card_status', args: { accountId: 'card-nubank' } },
    ],
    figures: async (ds) => [brl(await accountBalance(ds, 'acc-itau')), brl((await cardStatus(ds, 'card-nubank')).invoice)],
    answer: ([balance, invoice]) => `No Itaú você tem ${balance} e a fatura do Nubank está em ${invoice}.`,
  },
];
