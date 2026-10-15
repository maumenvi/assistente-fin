import { type UserNotification } from '../../domain/user-notification/user.notification.entity.ts';

/**
 * Porta de entrega das notificacoes (spec 013, RF-5, research R3): o caso de uso de emissao a
 * chama depois de persistir, para TODA notificacao (inclusive as suprimidas pelo limite, RF-9a -
 * o contador da tela precisa subir). Quem emite nao sabe como a notificacao aparece. Sincrona e
 * sem retorno; implementacoes nunca lancam (o trabalho assincrono fica com elas).
 */
export interface UserNotificationDeliveryPort {
  deliver(notification: UserNotification): void;
}
