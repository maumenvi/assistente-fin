import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando uma acao exige e-mail e telefone verificados (RF-28) e o usuario ainda nao
 * confirmou os dois - ex.: `CreateAccount` (CA-24).
 */
export class UserNotVerifiedError extends DomainError {
  public constructor() {
    super('USER_NOT_VERIFIED', 'e-mail e telefone precisam estar verificados');
  }
}
