import { type AiBlockIssue } from '../errors/ai.block.invalid.error.ts';
import { type PlannedOp } from './planned.op.ts';

export type AgentImportPlanStatus = 'ready' | 'already_applied' | 'invalid';

/** Contagens para o resumo da tela 5 (spec 029, FR-010). */
export interface AgentImportCounts {
  readonly create: number;
  readonly update: number;
  readonly pay: number;
  readonly duplicate: number;
  readonly destructive: number;
  readonly refused: number;
}

/**
 * Resultado do plano (contracts/agent.block.format.md): o que o app faria com o bloco, sem ter
 * escrito nada. Qualquer erro de validacao deixa o plano `invalid` e nada e salvo (FR-004).
 */
export interface AgentImportPlan {
  readonly batchId: string;
  readonly snapshotId: string | null;
  readonly status: AgentImportPlanStatus;
  readonly counts: AgentImportCounts;
  readonly ops: readonly PlannedOp[];
  readonly errors: readonly AiBlockIssue[];
  /** Operacoes sobre dados que mudaram desde a copia. */
  readonly staleCount: number;
}

export const EMPTY_IMPORT_COUNTS: AgentImportCounts = { create: 0, update: 0, pay: 0, duplicate: 0, destructive: 0, refused: 0 };
