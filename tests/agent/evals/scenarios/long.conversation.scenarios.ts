import { brl, expenseTotal, monthRange, uncategorizedStats } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

/** Cenarios de conversa longa e restricoes fixas ("so variaveis") (spec 037, US5, T044). */
export const LONG_CONVERSATION_SCENARIOS: readonly EvalScenario[] = [
  {
    id: 'long_conversation.so.variaveis.lazer.setembro',
    category: 'long_conversation',
    question: 'Considere só variáveis nesta conversa: quanto gastei com lazer em setembro de 2026?',
    calls: [{ name: 'query_transactions', args: { ...monthRange('2026-09'), category: 'Lazer' } }],
    figures: async (ds) => [brl(await expenseTotal(ds, { category: 'Lazer', month: '2026-09' }))],
    answer: ([lazer]) => `Considerando só variáveis, em setembro de 2026 você gastou ${lazer} com lazer.`,
  },
  {
    id: 'long_conversation.retomar.pendentes.apos.30.turnos',
    category: 'long_conversation',
    question: 'Voltando aos lançamentos sem categoria do início da conversa: quantos são e qual a soma total?',
    calls: [{ name: 'list_uncategorized_transactions', args: {} }],
    figures: async (ds) => {
      const u = await uncategorizedStats(ds);
      return [String(u.count), brl(u.totalCents)];
    },
    answer: ([count, total]) => `Voltando aos pendentes sem categoria: são ${count} lançamentos somando ${total}.`,
  },
];

