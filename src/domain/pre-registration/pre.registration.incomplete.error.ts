import { DomainError } from '../shared/domain.error.ts';
import { type PreRegistrationField } from './pre.registration.field.ts';

/** Tentativa de aprovar um pre-registro sem os campos obrigatorios de um lancamento (FR-024). */
export class PreRegistrationIncompleteError extends DomainError {
  /** Campos que faltam, na ordem em que a tela deve pedir. */
  public readonly missing: readonly PreRegistrationField[];

  public constructor(missing: readonly PreRegistrationField[]) {
    super('PRE_REGISTRATION_INCOMPLETE', `faltam dados para aprovar: ${missing.join(', ')}`);
    this.missing = missing;
  }
}
