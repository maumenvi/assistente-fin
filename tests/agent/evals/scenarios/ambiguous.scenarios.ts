import { NO_FIGURES, type EvalScenario } from './eval.scenario.ts';

const ASK = (id: string, question: string): EvalScenario => ({
  id: `ambiguous.${id}`,
  category: 'ambiguous',
  question,
  calls: [],
  figures: NO_FIGURES,
  answer: () => 'De qual período você quer saber: este mês, o mês passado ou outro?',
  expectsClarification: true,
});

export const AMBIGUOUS_SCENARIOS: readonly EvalScenario[] = [
  ASK('gasto.sem.periodo', 'Quanto gastei?'),
  ASK('categoria.sem.periodo', 'Quanto gastei com mercado?'),
  ASK('ganho.sem.periodo', 'Quanto recebi?'),
  ASK('comparar.sem.periodo', 'Gastei mais com lazer ou com transporte?'),
];
