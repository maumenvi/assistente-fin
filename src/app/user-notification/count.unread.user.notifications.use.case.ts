import { type Database } from '../shared/database.port.ts';
import { userNotificationOwnerInputSchema } from './user.notification.owner.input.schema.ts';
import { parseUserNotificationInput } from './parse.user.notification.input.ts';

/** Caso de uso "contar nao lidas" (spec 013, RF-13a): o numero do item "Notificacoes" no menu. */
export class CountUnreadUserNotificationsUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<{ count: number }> {
    const { userId } = parseUserNotificationInput(userNotificationOwnerInputSchema, rawInput, 'contar notificacoes');
    return { count: await this.database.userNotifications.countUnread(userId) };
  }
}
