import { type AgentRun } from '../../../../domain/agent/agent.run.ts';
import { type AgentRunSummary } from './agent.run.summary.ts';
import { type RunCheckpoint } from './run.checkpoint.ts';
import { type RunFinish } from './run.finish.ts';
import { type RunListFilter } from './run.list.filter.ts';

/** Execucoes do agente. */
export interface RunStorePort {
  create(run: AgentRun): Promise<void>;
  saveCheckpoint(userId: string, id: string, checkpoint: RunCheckpoint): Promise<void>;
  finish(userId: string, id: string, finish: RunFinish): Promise<void>;
  get(userId: string, id: string): Promise<AgentRun | null>;
  list(userId: string, filter: RunListFilter): Promise<AgentRunSummary[]>;
  /** Marca `running` com `heartbeatAt < olderThan` como `interrupted`; devolve as execucoes tocadas. */
  markStaleInterrupted(userId: string, olderThan: string): Promise<AgentRun[]>;
  deleteAll(userId: string): Promise<void>;
}
