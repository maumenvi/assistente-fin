import { type Consumed } from '../../../../domain/agent/consumed.ts';
import { type Intent } from '../../../../domain/agent/intent.ts';
import { type RunProfileIds } from '../../../../domain/agent/agent.run.ts';
import { type RunStatus } from '../../../../domain/agent/run.status.ts';

/** Resumo de uma execucao para listas (tela "Execucao do agente"). */
export interface AgentRunSummary {
  readonly id: string;
  readonly conversationId: string;
  /** Primeira linha da pergunta que originou a execucao. */
  readonly question: string;
  readonly status: RunStatus;
  readonly intent: Intent | null;
  readonly consumed: Consumed;
  readonly profileIds: RunProfileIds;
  /** Modelo principal usado (id do modelo no provedor), quando conhecido. */
  readonly model: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly errorCode: string | null;
}
