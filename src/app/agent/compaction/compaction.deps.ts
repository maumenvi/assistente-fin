import { type Clock } from '../../shared/clock.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type AgentEventsPort } from '../ports/events/agent.events.port.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type AgentLogPort } from '../ports/observe/agent.log.port.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { type MemoryContext } from '../preference/memory.context.ts';

/** Modelos da compactacao: quem resume e qual janela vale para o gatilho. */
export interface CompactionModel {
  /** Quem escreve o resumo (modelo rapido, senao o principal), ja respeitando consentimento e modo local. */
  readonly llm: LlmPort;
  readonly profileId: string;
  /** Janela do modelo principal - e para ele que o contexto e montado. */
  readonly contextWindow: number;
  /** Troca quando o modelo principal troca: reabilita a compactacao depois de falhas. */
  readonly modelKey: string;
}

/** Tudo de que o trabalho de compactacao precisa (spec 032). */
export interface CompactionDeps {
  readonly store: AgentStorePort;
  readonly memory: MemoryContext;
  readonly events: AgentEventsPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly log: AgentLogPort;
  /** `null` = sem modelo permitido agora (sem configuracao, consentimento ou modo local): nada a fazer. */
  model(userId: string): Promise<CompactionModel | null>;
  /** Instrucao do resumidor (`AgentPrompts.compactionSystem`). */
  systemPrompt(): string;
}
