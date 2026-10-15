import { type SyncOpResult } from './sync.op.result.ts';

/** Operacao ja aplicada pelo hub (idempotencia, spec 022 FR-010). */
export interface AppliedOp {
  readonly opId: string;
  readonly deviceId: string;
  readonly entity: string;
  readonly entityId: string;
  readonly resultVersion: string | null;
  readonly result: SyncOpResult;
  readonly appliedAt: Date;
}

/** Porta das operacoes aplicadas (tabela `sync_applied_ops` no desktop). */
export interface AppliedOpRepository {
  find(opId: string): Promise<AppliedOp | null>;
  save(op: AppliedOp): Promise<void>;
  /** A versao atual daquela linha foi produzida por uma operacao deste mesmo aparelho? */
  producedBy(deviceId: string, entity: string, entityId: string, version: string): Promise<boolean>;
}
