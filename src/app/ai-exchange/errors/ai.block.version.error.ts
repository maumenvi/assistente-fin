import { DomainError } from '../../../domain/shared/domain.error.ts';

/** O bloco declara uma versao do formato que este app nao entende (spec 029, R1). */
export class AiBlockVersionError extends DomainError {
  public readonly found: string;

  public constructor(found: string) {
    super('AI_BLOCK_VERSION', `versao do bloco nao suportada: ${found}`);
    this.found = found;
  }
}
