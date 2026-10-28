import { monthRange } from '../dataset/dataset.facts.ts';
import { NO_FIGURES, type EvalScenario } from './eval.scenario.ts';

const NONE = (id: string, question: string, month: string, category: string): EvalScenario => ({
  id: `no.data.${id}`,
  category: 'no_data',
  question,
  calls: [{ name: 'query_transactions', args: { ...monthRange(month), category } }],
  figures: NO_FIGURES,
  answer: () => 'Não encontrei lançamentos nesse período.',
});

export const NO_DATA_SCENARIOS: readonly EvalScenario[] = [
  NONE('mercado.2027-03', 'Quanto gastei com mercado em março de 2027?', '2027-03', 'Mercado'),
  NONE('lazer.2024-05', 'Quanto gastei com lazer em maio de 2024?', '2024-05', 'Lazer'),
  NONE('saude.2027-01', 'Quanto gastei com saúde em janeiro de 2027?', '2027-01', 'Saúde'),
  NONE('transporte.2025-01', 'Quanto gastei com transporte em janeiro de 2025?', '2025-01', 'Transporte'),
];
