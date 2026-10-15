import { type UserNotification } from '../../domain/user-notification/user.notification.entity.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { claimUserNotificationDeliveryInputSchema } from './claim.user.notification.delivery.input.schema.ts';
import { parseUserNotificationInput } from './parse.user.notification.input.ts';

/**
 * Caso de uso "reivindicar exibicao" (spec 013, RF-10, RF-11, RF-11a): marca as pendentes como
 * entregues e devolve so as que esta chamada reivindicou e ainda nao foram lidas - o que deve
 * virar toast. Lidas antes de exibidas sao marcadas como entregues, mas nao voltam.
 */
export class ClaimUserNotificationDeliveryUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<UserNotification[]> {
    const { userId, ids } = parseUserNotificationInput(claimUserNotificationDeliveryInputSchema, rawInput, 'reivindicar notificacoes');
    const claimed = await this.database.userNotifications.claimUndelivered(userId, this.clock.now(), ids);
    return claimed.filter((n) => !n.isRead);
  }
}
