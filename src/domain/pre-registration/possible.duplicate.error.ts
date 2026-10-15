import { DomainError } from '../shared/domain.error.ts';

/**
 * Aprovar um pre-registro marcado como possivel duplicata exige confirmacao explicita (spec 022,
 * FR-027): o usuario decide se vira lancamento ou e descartado.
 */
export class PossibleDuplicateError extends DomainError {
  /** Id do pre-registro ou lancamento parecido. */
  public readonly duplicateOf: string;

  public constructor(duplicateOf: string) {
    super('POSSIBLE_DUPLICATE', 'parece duplicado de um registro existente; confirme para aprovar');
    this.duplicateOf = duplicateOf;
  }
}
