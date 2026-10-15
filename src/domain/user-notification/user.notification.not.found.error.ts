import { DomainError } from '../shared/domain.error.ts';

/** Notificacao inexistente, ou de outro usuario (spec 013, RF-7). */
export class UserNotificationNotFoundError extends DomainError {
  public constructor() {
    super('USER_NOTIFICATION_NOT_FOUND', 'notificacao nao encontrada');
  }
}
