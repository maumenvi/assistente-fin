import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao tentar DEFINIR uma senha (`SetUserPassword`) num usuario que ja tem uma
 * (spec 002, RF-9, RF-9a). Trocar exige a senha atual - e `ChangeUserPassword`.
 */
export class PasswordAlreadySetError extends DomainError {
  public constructor() {
    super('PASSWORD_ALREADY_SET', 'o usuario ja tem senha - use a troca de senha');
  }
}
