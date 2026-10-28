import { type Consumed } from './consumed.ts';
import { type Intent } from './intent.ts';
import { type RunBudget } from './run.budget.ts';
import { type RunStatus } from './run.status.ts';

/** Perfis usados numa execucao. */
export interface RunProfileIds {
  readonly main: string | null;
  readonly fast: string | null;
  /** Verdadeiro quando o perfil alternativo respondeu no lugar do principal. */
  readonly fallbackUsed: boolean;
}

/**
 * Uma rodada do agente para atender um pedido (spec 031, data-model.md 1). `state` e o
 * checkpoint: JSON puro com o cursor do grafo e o rascunho da execucao.
 */
export interface AgentRun {
  readonly id: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly userMessageId: string;
  readonly assistantMessageId: string;
  readonly status: RunStatus;
  readonly currentNode: string | null;
  readonly intent: Intent | null;
  readonly budget: RunBudget;
  readonly consumed: Consumed;
  readonly profileIds: RunProfileIds;
  /** Modelo principal usado (id no provedor); passa a ser o alternativo se ele responder. */
  readonly model: string | null;
  readonly state: unknown;
  readonly startedAt: string;
  readonly endedAt: string | null;
  /** Renovado a cada passo; permite achar execucoes mortas (`recoverRuns`). */
  readonly heartbeatAt: string;
  readonly errorCode: string | null;
}
