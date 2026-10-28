import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { type RoutingStrategy } from '../../../domain/agent/routing/routing.strategy.ts';
import { type RunBudget } from '../../../domain/agent/run.budget.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type AgentEventsPort } from '../ports/events/agent.events.port.ts';
import { type AgentLogPort } from '../ports/observe/agent.log.port.ts';
import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';

/** O que o runner precisa para executar um grafo (os nos recebem a extensao `NodeContext`). */
export interface RunnerContext {
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string;
  readonly store: AgentStorePort;
  readonly events: AgentEventsPort;
  readonly trace: AgentTracePort;
  readonly log: AgentLogPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly signal: AbortSignal;
  readonly budget: RunBudget;
  /** Ids dos perfis usados (para o checkpoint). */
  readonly profileIds: { readonly main: string | null; readonly fast: string | null; readonly fallbackUsed?: boolean };
  /** Modelo principal configurado (id no provedor); o runner o atualiza se o alternativo responder. */
  readonly mainModel: string | null;
  /** Acumulador do tempo que a execucao esperou a pessoa decidir (pasta, edicao); sai do orcamento de tempo (spec 040). */
  readonly waited?: { ms: number };
  /** Estrategia de roteamento entre os 3 niveis (spec 038). */
  readonly routingStrategy?: RoutingStrategy | undefined;
  /** Perfis configurados para calculo de custo e baseline de telemetria (spec 038). */
  readonly metricProfiles?: {
    readonly main: ModelProfile;
    readonly fast?: ModelProfile | null;
    readonly fallback?: ModelProfile | null;
  };
}
