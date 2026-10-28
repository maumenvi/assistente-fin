import { type AgentWritersFactory } from '../../../../composition/build.agent.writers.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type Clock } from '../../../shared/clock.port.ts';
import { type Database } from '../../../shared/database.port.ts';
import { type IdGenerator } from '../../../shared/id.generator.port.ts';
import { type AgentToolDeps } from '../../tools/shared/agent.tool.deps.ts';

/** O que o motor de planos precisa (spec 033): banco, escritores por transacao, ids, relogio e consultas. */
export interface PlanEngineDeps {
  readonly db: Database;
  readonly writers: AgentWritersFactory;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly toolDeps: Pick<AgentToolDeps, 'calculateCreditCardAvailableLimit'>;
  /** Chamado a cada mudanca de estado do plano (alimenta o evento `plan_updated`); nunca quebra o motor. */
  readonly notify?: ((plan: Plan) => void) | undefined;
}
