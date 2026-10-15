import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de uma notificacao violam uma invariante do dominio (spec 013). */
export class InvalidUserNotificationError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_USER_NOTIFICATION', `notificacao invalida: ${reason}`);
  }
}
