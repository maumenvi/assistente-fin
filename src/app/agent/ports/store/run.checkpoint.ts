import { type Consumed } from '../../../../domain/agent/consumed.ts';
import { type Intent } from '../../../../domain/agent/intent.ts';
import { type RunProfileIds } from '../../../../domain/agent/agent.run.ts';

/** Ponto de salvamento de uma execucao: cursor do grafo, estado serializavel, consumo e batimento. */
export interface RunCheckpoint {
  readonly currentNode: string | null;
  readonly intent: Intent | null;
  readonly consumed: Consumed;
  readonly profileIds: RunProfileIds;
  readonly model: string | null;
  readonly state: unknown;
  readonly heartbeatAt: string;
}
