import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando a senha informada nao confere com a do usuario (spec 002, RF-9, CA-8). */
export class BadCredentialsError extends DomainError {
  public constructor() {
    super('BAD_CREDENTIALS', 'senha incorreta');
  }
}
