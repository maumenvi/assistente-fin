import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando a chave de recuperacao informada nao confere com a do usuario, ou ja foi
 * usada (spec 002, RF-9c, CA-9g).
 */
export class BadRecoveryKeyError extends DomainError {
  public constructor() {
    super('BAD_RECOVERY_KEY', 'chave de recuperacao invalida');
  }
}
