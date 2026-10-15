import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um pre-registro violam uma invariante do dominio (spec 022). */
export class InvalidPreRegistrationError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_PRE_REGISTRATION', `pre-registro invalido: ${reason}`);
  }
}
