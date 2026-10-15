import { DomainError } from '../../../domain/shared/domain.error.ts';

/** A operacao pedida nao cabe no estado atual do lote (ex.: desfazer um lote ja desfeito). */
export class AiBatchStateError extends DomainError {
  public constructor(message: string) {
    super('AI_BATCH_STATE', message);
  }
}
