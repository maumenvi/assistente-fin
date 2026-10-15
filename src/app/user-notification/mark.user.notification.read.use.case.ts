import { UserNotificationNotFoundError } from '../../domain/user-notification/user.notification.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { markUserNotificationReadInputSchema } from './mark.user.notification.read.input.schema.ts';
import { parseUserNotificationInput } from './parse.user.notification.input.ts';

/** Caso de uso "marcar notificacao como lida" (spec 013, RF-7): idempotente, no escopo do usuario. */
export class MarkUserNotificationReadUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const { userId, id } = parseUserNotificationInput(markUserNotificationReadInputSchema, rawInput, 'marcar notificacao como lida');
    const notification = await this.database.userNotifications.findById(userId, id);
    if (!notification) throw new UserNotificationNotFoundError();
    if (notification.isRead) return;
    await this.database.userNotifications.save(notification.markRead(this.clock.now()));
  }
}
