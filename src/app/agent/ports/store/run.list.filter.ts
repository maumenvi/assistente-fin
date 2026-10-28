import { type RunStatus } from '../../../../domain/agent/run.status.ts';

/** Filtros da lista de execucoes (FR-040). `before` e o cursor (`startedAt` da ultima linha). */
export interface RunListFilter {
  readonly status?: RunStatus;
  readonly model?: string;
  readonly limit: number;
  readonly before?: string;
}
