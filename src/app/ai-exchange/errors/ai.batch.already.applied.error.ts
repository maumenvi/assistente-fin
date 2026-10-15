import { DomainError } from '../../../domain/shared/domain.error.ts';

/** O lote ja foi aplicado ou dispensado antes (spec 029, FR-005, SC-004). */
export class AiBatchAlreadyAppliedError extends DomainError {
  public readonly batchId: string;

  public constructor(batchId: string) {
    super('AI_BATCH_ALREADY_APPLIED', 'este lote ja foi aplicado');
    this.batchId = batchId;
  }
}
