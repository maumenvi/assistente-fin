import { type RunStep } from '../../../../domain/agent/run.step.ts';

/** Passos executados. */
export interface StepStorePort {
  /** Idempotente por `(runId, seq)`: repetir o mesmo passo nao duplica. */
  appendMany(userId: string, steps: readonly RunStep[]): Promise<void>;
  /** Em ordem de `seq`. */
  list(userId: string, runId: string): Promise<RunStep[]>;
}
