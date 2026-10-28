import { type RoutingStrategy } from '../../../domain/agent/routing/routing.strategy.ts';
import { type RunBudget } from '../../../domain/agent/run.budget.ts';
import { type ModelProfileView } from './model.profile.view.ts';

/** Configuracao do agente como a tela a recebe (nunca leva a chave de API). */
export interface AgentSettingsView {
  readonly profiles: readonly ModelProfileView[];
  readonly localOnly: boolean;
  readonly limits: RunBudget;
  readonly routingStrategy?: RoutingStrategy | undefined;
}
