import { type Consumed } from '../../../../domain/agent/consumed.ts';
import { type RunStatus } from '../../../../domain/agent/run.status.ts';

/** Fechamento de uma execucao (gravado de forma sincrona antes de publicar `run_finished`). */
export interface RunFinish {
  readonly status: RunStatus;
  readonly endedAt: string;
  readonly errorCode: string | null;
  readonly consumed: Consumed;
  readonly state: unknown;
}
