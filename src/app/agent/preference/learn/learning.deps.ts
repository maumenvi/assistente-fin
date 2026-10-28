import { type Clock } from '../../../shared/clock.port.ts';
import { type IdGenerator } from '../../../shared/id.generator.port.ts';
import { type AgentEventsPort } from '../../ports/events/agent.events.port.ts';
import { type LlmPort } from '../../ports/llm/llm.port.ts';
import { type AgentLogPort } from '../../ports/observe/agent.log.port.ts';
import { type AgentStorePort } from '../../ports/store/agent.store.port.ts';
import { type MemoryContext } from '../memory.context.ts';

/** Tudo de que o aprendizado organico precisa (spec 032). */
export interface LearningDeps {
  readonly memory: MemoryContext;
  readonly store: AgentStorePort;
  readonly events: AgentEventsPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly log: AgentLogPort;
  /**
   * Modelo (rapido, senao o principal) que pode refinar a redacao de uma candidata nova, ja
   * respeitando consentimento e modo so-local; `null` = sem refino. Nunca lanca.
   */
  refineModel(userId: string): Promise<LlmPort | null>;
}
