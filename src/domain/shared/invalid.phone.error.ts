import { DomainError } from './domain.error.ts';

/** Lancado quando o telefone informado nao e um numero brasileiro valido. */
export class InvalidPhoneError extends DomainError {
  public constructor() {
    super('INVALID_PHONE', 'telefone invalido');
  }
}
