import { brl, uncategorizedStats } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

/** Cenarios de lancamentos sem categoria em 4 redacoes distintas (spec 037, US5, T041). */
export const UNCATEGORIZED_SCENARIOS: readonly EvalScenario[] = [
  {
    id: 'uncategorized.o.que.esta.sem.categoria',
    category: 'uncategorized',
    question: 'O que está sem categoria?',
    calls: [{ name: 'list_uncategorized_transactions', args: {} }],
    figures: async (ds) => {
      const s = await uncategorizedStats(ds);
      return [String(s.count), brl(s.totalCents)];
    },
    answer: ([count, total]) => `Você tem ${count} lançamentos sem categoria, somando ${total}.`,
  },
  {
    id: 'uncategorized.quais.pendentes',
    category: 'uncategorized',
    question: 'Quais lançamentos estão pendentes de classificação em todas as contas?',
    calls: [{ name: 'list_uncategorized_transactions', args: {} }],
    figures: async (ds) => {
      const s = await uncategorizedStats(ds);
      return [String(s.count), brl(s.totalCents)];
    },
    answer: ([count, total]) => `Existem ${count} lançamentos pendentes de classificação nas suas contas, totalizando ${total}.`,
  },
  {
    id: 'uncategorized.contagem.e.soma',
    category: 'uncategorized',
    question: 'Quantos gastos estão em SEM CATEGORIA e qual o valor total deles?',
    calls: [{ name: 'list_uncategorized_transactions', args: {} }],
    figures: async (ds) => {
      const s = await uncategorizedStats(ds);
      return [String(s.count), brl(s.totalCents)];
    },
    answer: ([count, total]) => `São ${count} lançamentos em SEM CATEGORIA, com soma total de ${total}.`,
  },
  {
    id: 'uncategorized.conta.itau',
    category: 'uncategorized',
    question: 'Tem lançamentos sem categoria no Itaú? Quantos no total geral?',
    calls: [{ name: 'list_uncategorized_transactions', args: {} }],
    figures: async (ds) => {
      const s = await uncategorizedStats(ds);
      return [String(s.count), brl(s.totalCents)];
    },
    answer: ([count, total]) => `No total geral há ${count} lançamentos sem categoria (${total}).`,
  },
];

