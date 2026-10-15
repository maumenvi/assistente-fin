import { DomainError } from './domain.error.ts';

/** Lancado quando o e-mail informado nao tem um formato valido. */
export class InvalidEmailError extends DomainError {
  public constructor() {
    super('INVALID_EMAIL', 'e-mail invalido');
  }
}
