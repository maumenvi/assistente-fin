import { DomainError } from '../shared/domain.error.ts';

/** Pre-registro inexistente, ou de outro usuario (spec 022). */
export class PreRegistrationNotFoundError extends DomainError {
  public constructor() {
    super('PRE_REGISTRATION_NOT_FOUND', 'pre-registro nao encontrado');
  }
}
