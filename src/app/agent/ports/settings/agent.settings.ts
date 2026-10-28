import { type ModelProfile } from '../../../../domain/agent/model.profile.ts';
import { type RoutingStrategy } from '../../../../domain/agent/routing/routing.strategy.ts';
import { type RunBudget } from '../../../../domain/agent/run.budget.ts';

/** Configuracao do agente de um usuario. Nunca contem a chave de API em claro. */
export interface AgentSettings {
  readonly profiles: readonly ModelProfile[];
  /** "Usar somente modelos locais": perfis de nuvem ficam inativos (FR-028). */
  readonly localOnly: boolean;
  readonly limits: RunBudget;
  /** Estrategia de roteamento entre os 3 niveis (spec 038, FR-017). */
  readonly routingStrategy?: RoutingStrategy | undefined;
}
