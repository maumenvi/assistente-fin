import { DomainError } from '../../../domain/shared/domain.error.ts';

/** Nao existe lote com esse id no diario (spec 029, FR-007). */
export class AiBatchNotFoundError extends DomainError {
  public constructor() {
    super('AI_BATCH_NOT_FOUND', 'lote nao encontrado');
  }
}
