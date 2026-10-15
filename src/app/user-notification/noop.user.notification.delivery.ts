import { type UserNotification } from '../../domain/user-notification/user.notification.entity.ts';
import { type UserNotificationDeliveryPort } from './user.notification.delivery.port.ts';

/** Entrega que nao faz nada: padrao fora do desktop (testes, celular). A notificacao so fica no historico. */
export class NoopUserNotificationDelivery implements UserNotificationDeliveryPort {
  public deliver(_notification: UserNotification): void {
    // sem canal de exibicao neste ambiente
  }
}
