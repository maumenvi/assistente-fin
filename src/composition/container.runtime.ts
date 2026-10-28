import { type UserNotificationDeliveryPort } from '../app/user-notification/user.notification.delivery.port.ts';

/**
 * Objetos vivos que a borda injeta no `Container` alem da config (spec 013, research R3). Ao
 * contrario da `ContainerConfig` (dados), sobrevivem as reconexoes: o desktop passa o mesmo
 * apresentador de notificacoes a cada `Container` novo.
 */
export interface ContainerRuntime {
  /** Exibicao das notificacoes (toast nativo no desktop); ausente = so historico. */
  readonly userNotificationDelivery?: UserNotificationDeliveryPort | undefined;
}
