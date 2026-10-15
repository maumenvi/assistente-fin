import { DomainError } from '../../../domain/shared/domain.error.ts';

/** Um problema de validacao do bloco, apontando a operacao e o campo (sem valores do usuario). */
export interface AiBlockIssue {
  /** Indice da operacao em `ops`, ou -1 quando o problema e do bloco todo. */
  readonly opIndex: number;
  readonly path: string;
  readonly message: string;
}

/** O bloco existe, mas esta fora do formato (spec 029, FR-004, SC-003). Nada e salvo. */
export class AiBlockInvalidError extends DomainError {
  public readonly issues: readonly AiBlockIssue[];

  public constructor(issues: readonly AiBlockIssue[]) {
    super('AI_BLOCK_INVALID', 'bloco fora do formato');
    this.issues = issues;
  }
}
