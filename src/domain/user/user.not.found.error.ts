import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o usuario referenciado (ex.: `userId` de uma conta) nao existe. */
export class UserNotFoundError extends DomainError {
  public constructor() {
    super('USER_NOT_FOUND', 'usuario nao encontrado');
  }
}
