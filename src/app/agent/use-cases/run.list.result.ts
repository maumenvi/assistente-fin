import { type AgentRunSummary } from '../ports/store/agent.run.summary.ts';

/** Totais da pagina de execucoes listada. `cost` e `null` se alguma execucao nao informou custo. */
export interface RunListTotals {
  readonly count: number;
  readonly ms: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicroUsd: number | null;
}

/** Pagina da lista de execucoes. */
export interface RunListResult {
  readonly runs: readonly AgentRunSummary[];
  readonly totals: RunListTotals;
  /** Cursor da proxima pagina (`startedAt` da ultima linha) ou `null` se acabou. */
  readonly next: string | null;
}
