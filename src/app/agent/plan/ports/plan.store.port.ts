import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanStatus } from '../../../../domain/plan/plan.status.ts';

/** Filtro da lista de planos: mais recentes primeiro; `before` e a data (ISO) do ultimo item da pagina anterior. */
export interface PlanListFilter {
  readonly status?: readonly PlanStatus[];
  readonly limit?: number;
  readonly before?: string;
}

/** Planos do agente (spec 033). Locais ao aparelho; todo acesso filtra por `userId`. */
export interface PlanStorePort {
  /** Upsert por `id` (o plano inteiro, com itens e aplicacoes). */
  save(plan: Plan): Promise<void>;
  get(userId: string, id: string): Promise<Plan | null>;
  list(userId: string, filter?: PlanListFilter): Promise<Plan[]>;
  /** Planos criados por uma execucao do agente (ponto de aprovacao mostrado no detalhe da execucao). */
  listByRun(userId: string, runId: string): Promise<Plan[]>;
  /** `approved` sem aplicacao: sobras de um fechamento no meio (recuperacao). */
  listApproved(userId: string): Promise<Plan[]>;
  /** `pending` com `expiresAt` anterior a `now`. */
  listPendingExpired(userId: string, now: string): Promise<Plan[]>;
  deleteAll(userId: string): Promise<void>;
}
