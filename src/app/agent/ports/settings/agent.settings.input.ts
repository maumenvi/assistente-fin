import { type RoutingStrategy } from '../../../../domain/agent/routing/routing.strategy.ts';
import { type RunBudget } from '../../../../domain/agent/run.budget.ts';
import { type ModelProfileInput } from './model.profile.input.ts';

/** Configuracao enviada pela tela ao salvar. */
export interface AgentSettingsInput {
  readonly profiles: readonly ModelProfileInput[];
  readonly localOnly: boolean;
  readonly limits: RunBudget;
  readonly routingStrategy?: RoutingStrategy | undefined;
}
