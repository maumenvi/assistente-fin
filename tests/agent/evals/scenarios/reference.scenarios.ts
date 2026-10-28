import { brl, expenseTotal, monthRange, monthSummary } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

/** Cenarios de resolucao de referencias e continuidade (spec 037, US5, T044). */
export const REFERENCE_SCENARIOS: readonly EvalScenario[] = [
  {
    id: 'reference.e.em.outubro.mercado',
    category: 'reference',
    question: 'Consultei mercado em setembro; e em outubro de 2026, quanto gastei com mercado?',
    calls: [{ name: 'query_transactions', args: { ...monthRange('2026-10'), category: 'Mercado' } }],
    figures: async (ds) => [brl(await expenseTotal(ds, { category: 'Mercado', month: '2026-10' }))],
    answer: ([oct]) => `Em outubro de 2026 você gastou ${oct} com mercado.`,
  },
  {
    id: 'reference.segundo.item.transporte.setembro',
    category: 'reference',
    question: 'Entre lazer e transporte em setembro de 2026, quanto gastei no segundo (transporte)?',
    calls: [{ name: 'query_transactions', args: { ...monthRange('2026-09'), category: 'Transporte' } }],
    figures: async (ds) => [brl(await expenseTotal(ds, { category: 'Transporte', month: '2026-09' }))],
    answer: ([transp]) => `No segundo item (transporte), em setembro de 2026 você gastou ${transp}.`,
  },
  {
    id: 'reference.continue.resumo.agosto',
    category: 'reference',
    question: 'Continue o resumo de agosto de 2026 informando o total de despesas e o saldo do mês.',
    calls: [{ name: 'get_month_summary', args: { month: '2026-08' } }],
    figures: async (ds) => {
      const s = await monthSummary(ds, '2026-08');
      return [brl(s.expense), brl(s.balance)];
    },
    answer: ([exp, bal]) => `Continuando o resumo de agosto de 2026: despesas ${exp} e resultado ${bal}.`,
  },
];

