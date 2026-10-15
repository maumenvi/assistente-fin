import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um usuario violam uma invariante do dominio. */
export class InvalidUserError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_USER', `usuario invalido: ${reason}`);
  }
}
