import { type AgentEntity } from './format/agent.entity.ts';
import { type AgentOp } from './format/agent.op.ts';
import { type AgentOpKind } from './format/agent.op.kind.ts';
import { type AiBatchOpOutcome } from './ai.batch.op.outcome.ts';
import { type JournalImage } from './journal.image.ts';
import { type OpPreview } from './op.preview.ts';

/** Uma operacao do lote ja tratada, com a imagem anterior e a posterior (spec 029, R4). */
export interface AiBatchOp {
  readonly batchId: string;
  readonly seq: number;
  readonly ref: string | null;
  readonly kind: AgentOpKind;
  readonly entity: AgentEntity;
  /** Id da entidade afetada (ou do grupo parcelado); `null` quando nada foi afetado. */
  readonly entityId: string | null;
  /** A operacao como o agente a enviou: as destrutivas pendentes sao executadas a partir dela. */
  readonly op: AgentOp;
  readonly before: JournalImage | null;
  readonly after: JournalImage | null;
  /** Descricao da operacao para as telas; `null` em lotes sem plano guardado. */
  readonly preview: OpPreview | null;
  readonly outcome: AiBatchOpOutcome;
  readonly reason: string | null;
}
