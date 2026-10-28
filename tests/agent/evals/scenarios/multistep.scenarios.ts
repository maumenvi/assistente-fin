import {
  accountBalance,
  brl,
  cardStatus,
  fixedExpensesTotal,
  forecastBalance,
  limitStatus,
  monthSummary,
  uncategorizedStats,
} from '../dataset/dataset.facts.ts';
import { type EvalScenario, NO_FIGURES } from './eval.scenario.ts';

/** 10 pedidos multietapas (spec 037, US5, T043): encadeiam ferramentas sem perguntas desnecessarias; 1 ambiguo faz 1 pergunta curta. */
export const MULTISTEP_SCENARIOS: readonly EvalScenario[] = [
  {
    id: 'multistep.compare.ago.set.e.limites',
    category: 'multistep',
    question: 'Compare meus gastos de agosto e setembro de 2026 e me diga quanto resta do limite de mercado em outubro.',
    calls: [
      { name: 'compare_periods', args: { a: '2026-08', b: '2026-09', groupBy: 'category', kind: 'expense' } },
      { name: 'get_spending_limits', args: { month: '2026-10' } },
    ],
    figures: async (ds) => {
      const sa = await monthSummary(ds, '2026-08');
      const sb = await monthSummary(ds, '2026-09');
      const lim = await limitStatus(ds, 'cat-mercado');
      return [brl(sa.expense), brl(sb.expense), brl(lim.remaining)];
    },
    answer: ([expA, expB, rem]) =>
      `Em agosto seus gastos foram ${expA} e em setembro ${expB}. No limite de mercado em outubro ainda restam ${rem}.`,
  },
  {
    id: 'multistep.pendentes.e.resumo.setembro',
    category: 'multistep',
    question: 'Quantos lançamentos estão sem categoria, qual a soma deles e qual foi minha despesa total em setembro de 2026?',
    calls: [
      { name: 'list_uncategorized_transactions', args: {} },
      { name: 'get_month_summary', args: { month: '2026-09' } },
    ],
    figures: async (ds) => {
      const u = await uncategorizedStats(ds);
      const s = await monthSummary(ds, '2026-09');
      return [String(u.count), brl(u.totalCents), brl(s.expense)];
    },
    answer: ([count, totalUncat, expSept]) =>
      `Você tem ${count} lançamentos sem categoria (${totalUncat}), e a despesa total de setembro de 2026 foi ${expSept}.`,
  },
  {
    id: 'multistep.saldos.e.faturas.ambos.cartoes',
    category: 'multistep',
    question: 'Quanto tenho no Itaú e quanto estão as faturas dos cartões Nubank e Iti?',
    calls: [
      { name: 'get_account_balances', args: { accountId: 'acc-itau' } },
      { name: 'get_credit_card_status', args: { accountId: 'card-nubank' } },
      { name: 'get_credit_card_status', args: { accountId: 'card-iti' } },
    ],
    figures: async (ds) => [
      brl(await accountBalance(ds, 'acc-itau')),
      brl((await cardStatus(ds, 'card-nubank')).invoice),
      brl((await cardStatus(ds, 'card-iti')).invoice),
    ],
    answer: ([itau, nubank, iti]) =>
      `No Itaú seu saldo é ${itau}; a fatura do Nubank está em ${nubank} e a do Iti em ${iti}.`,
  },
  {
    id: 'multistep.fixos.e.previsao.novembro',
    category: 'multistep',
    question: 'Qual o total dos meus gastos fixos cadastrados e qual o saldo previsto para novembro de 2026?',
    calls: [
      { name: 'list_fixed_expenses', args: {} },
      { name: 'get_forecast', args: { fromMonth: '2026-11' } },
    ],
    figures: async (ds) => [brl(await fixedExpensesTotal(ds)), brl(await forecastBalance(ds, '2026-11'))],
    answer: ([fixed, forecast]) =>
      `Seus gastos fixos somam ${fixed} por mês e o saldo previsto para novembro de 2026 é ${forecast}.`,
  },
  {
    id: 'multistep.resumo.outubro.e.pendentes',
    category: 'multistep',
    question: 'Mostre as receitas e despesas de outubro de 2026 e quantos lançamentos sem categoria existem.',
    calls: [
      { name: 'get_month_summary', args: { month: '2026-10' } },
      { name: 'list_uncategorized_transactions', args: {} },
    ],
    figures: async (ds) => {
      const s = await monthSummary(ds, '2026-10');
      const u = await uncategorizedStats(ds);
      return [brl(s.income), brl(s.expense), String(u.count)];
    },
    answer: ([inc, exp, count]) =>
      `Em outubro de 2026: receitas ${inc}, despesas ${exp}, e há ${count} lançamentos sem categoria.`,
  },
  {
    id: 'multistep.comparar.jul.ago.set',
    category: 'multistep',
    question: 'Compare o total de despesas de julho com agosto e também de agosto com setembro de 2026.',
    calls: [
      { name: 'compare_periods', args: { a: '2026-07', b: '2026-08', groupBy: 'category', kind: 'expense' } },
      { name: 'compare_periods', args: { a: '2026-08', b: '2026-09', groupBy: 'category', kind: 'expense' } },
    ],
    figures: async (ds) => {
      const jul = await monthSummary(ds, '2026-07');
      const ago = await monthSummary(ds, '2026-08');
      const set = await monthSummary(ds, '2026-09');
      return [brl(jul.expense), brl(ago.expense), brl(set.expense)];
    },
    answer: ([jul, ago, set]) =>
      `Despesas totais: julho ${jul}, agosto ${ago} e setembro ${set}.`,
  },
  {
    id: 'multistep.saldo.total.e.previsao.dezembro',
    category: 'multistep',
    question: 'Qual o saldo atual do Itaú e da poupança, e como fica a previsão para dezembro de 2026?',
    calls: [
      { name: 'get_account_balances', args: {} },
      { name: 'get_forecast', args: { fromMonth: '2026-12' } },
    ],
    figures: async (ds) => [
      brl(await accountBalance(ds, 'acc-itau')),
      brl(await accountBalance(ds, 'acc-poupanca')),
      brl(await forecastBalance(ds, '2026-12')),
    ],
    answer: ([itau, poup, dec]) =>
      `Você tem ${itau} no Itaú, ${poup} na poupança e saldo previsto de ${dec} para dezembro de 2026.`,
  },
  {
    id: 'multistep.fatura.nubank.e.limite.lazer',
    category: 'multistep',
    question: 'Quanto está o limite disponível do Nubank e quanto já gastei do limite de lazer em outubro?',
    calls: [
      { name: 'get_credit_card_status', args: { accountId: 'card-nubank' } },
      { name: 'get_spending_limits', args: { month: '2026-10' } },
    ],
    figures: async (ds) => [
      brl((await cardStatus(ds, 'card-nubank')).available),
      brl((await limitStatus(ds, 'cat-lazer')).spent),
    ],
    answer: ([avail, lazerSpent]) =>
      `O limite disponível do Nubank é ${avail} e você gastou ${lazerSpent} no limite de lazer em outubro.`,
  },
  {
    id: 'multistep.corte.20pct.sobre.valor',
    category: 'multistep',
    question: 'Quanto tenho na carteira e quanto é 20% de R$ 1.500,00 em 3 meses?',
    calls: [
      { name: 'get_account_balances', args: { accountId: 'acc-carteira' } },
      { name: 'calculate', args: { op: 'expr', expression: '(1500 * 20%) * 3' } },
    ],
    figures: async (ds) => [brl(await accountBalance(ds, 'acc-carteira')), 'R$ 900,00'],
    answer: ([wallet, saved]) =>
      `Na carteira você tem ${wallet}, e 20% de R$ 1.500,00 em 3 meses soma ${saved}.`,
  },
  {
    id: 'multistep.ambiguo.organiza.isso',
    category: 'multistep',
    question: 'Organiza isso pra mim.',
    calls: [],
    figures: NO_FIGURES,
    expectsClarification: true,
    answer: () =>
      'O que você prefere organizar agora: classificar os lançamentos sem categoria, revisar os gastos fixos ou ver o resumo do mês?',
  },
];

