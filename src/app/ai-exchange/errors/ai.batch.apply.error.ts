import { DomainError } from '../../../domain/shared/domain.error.ts';

/** Uma operacao do lote falhou ao ser aplicada; todas as seguras foram revertidas (spec 029, R3). */
export class AiBatchApplyError extends DomainError {
  public readonly opIndex: number;
  public override readonly cause: unknown;

  public constructor(opIndex: number, cause: unknown) {
    super('AI_BATCH_APPLY', 'uma operacao do lote falhou e nada foi salvo');
    this.opIndex = opIndex;
    this.cause = cause;
  }
}
