import { NO_FIGURES, type EvalScenario } from './eval.scenario.ts';

export const OUT_OF_SCOPE_SCENARIOS: readonly EvalScenario[] = [
  { id: 'out.of.scope.piada', category: 'out_of_scope', question: 'Me conta uma piada.', calls: [], figures: NO_FIGURES, answer: () => 'Não posso.', expectsCanned: 'canned_scope' },
  { id: 'out.of.scope.tempo', category: 'out_of_scope', question: 'Qual a previsão do tempo para amanhã?', calls: [], figures: NO_FIGURES, answer: () => 'Não posso.', expectsCanned: 'canned_scope' },
];
