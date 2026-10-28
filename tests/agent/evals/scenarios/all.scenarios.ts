import { AMBIGUOUS_SCENARIOS } from './ambiguous.scenarios.ts';
import { CARD_SCENARIOS } from './card.scenarios.ts';
import { COMPOSITE_SCENARIOS } from './composite.scenarios.ts';
import { type EvalScenario } from './eval.scenario.ts';
import { FORECAST_SCENARIOS } from './forecast.scenarios.ts';
import { INJECTION_SCENARIOS } from './injection.scenarios.ts';
import { LONG_CONVERSATION_SCENARIOS } from './long.conversation.scenarios.ts';
import { MULTISTEP_SCENARIOS } from './multistep.scenarios.ts';
import { NO_DATA_SCENARIOS } from './no.data.scenarios.ts';
import { NUMERIC_SCENARIOS } from './numeric.scenarios.ts';
import { OUT_OF_SCOPE_SCENARIOS } from './out.of.scope.scenarios.ts';
import { REFERENCE_SCENARIOS } from './reference.scenarios.ts';
import { SIMPLE_SCENARIOS } from './simple.scenarios.ts';
import { UNCATEGORIZED_SCENARIOS } from './uncategorized.scenarios.ts';
import { WRITE_SCENARIOS } from './write.scenarios.ts';

/** Todos os cenarios da avaliacao (>= 60). */
export const ALL_SCENARIOS: readonly EvalScenario[] = [
  ...SIMPLE_SCENARIOS,
  ...COMPOSITE_SCENARIOS,
  ...FORECAST_SCENARIOS,
  ...CARD_SCENARIOS,
  ...AMBIGUOUS_SCENARIOS,
  ...NO_DATA_SCENARIOS,
  ...WRITE_SCENARIOS,
  ...INJECTION_SCENARIOS,
  ...OUT_OF_SCOPE_SCENARIOS,
  ...UNCATEGORIZED_SCENARIOS,
  ...NUMERIC_SCENARIOS,
  ...MULTISTEP_SCENARIOS,
  ...REFERENCE_SCENARIOS,
  ...LONG_CONVERSATION_SCENARIOS,
];
