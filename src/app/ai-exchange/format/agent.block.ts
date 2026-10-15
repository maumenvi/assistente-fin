import { type AgentOp } from './agent.op.ts';

/** Bloco devolvido pelo agente, ja validado na forma (spec 029, contracts/agent.block.format.md). */
export interface AgentBlock {
  readonly batchId: string;
  readonly snapshotId?: string | undefined;
  readonly ops: readonly AgentOp[];
}
