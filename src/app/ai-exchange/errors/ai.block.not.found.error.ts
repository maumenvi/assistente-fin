import { DomainError } from '../../../domain/shared/domain.error.ts';

/** Nao ha bloco `FINCTRL-IMPORT` no texto recebido (spec 029, FR-016). */
export class AiBlockNotFoundError extends DomainError {
  public constructor() {
    super('AI_BLOCK_NOT_FOUND', 'nenhum bloco FINCTRL-IMPORT no texto');
  }
}
