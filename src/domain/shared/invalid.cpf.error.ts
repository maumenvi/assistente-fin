import { DomainError } from './domain.error.ts';

/**
 * Lancado quando um CPF informado nao tem 11 digitos, e uma sequencia repetida
 * (ex: `111.111.111-11`) ou falha na verificacao dos digitos verificadores.
 */
export class InvalidCpfError extends DomainError {
  public constructor() {
    super('INVALID_CPF', 'CPF invalido');
  }
}
