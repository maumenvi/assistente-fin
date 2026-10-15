import { type Database } from '../shared/database.port.ts';
import { listUserNotificationsInputSchema } from './list.user.notifications.input.schema.ts';
import { parseUserNotificationInput } from './parse.user.notification.input.ts';
import { type UserNotificationPage } from './user.notification.page.ts';

/** Caso de uso "listar notificacoes" (spec 013, RF-6, RF-7a, RF-13): paginado, mais recentes primeiro. */
export class ListUserNotificationsUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<UserNotificationPage> {
    const { userId, page, pageSize, unreadOnly } = parseUserNotificationInput(
      listUserNotificationsInputSchema,
      rawInput,
      'listar notificacoes',
    );
    const { items, total } = await this.database.userNotifications.listByUser(userId, { page, pageSize, unreadOnly });
    const hasMore = page * pageSize < total;
    return { items, page, pageSize, total, hasMore, nextPage: hasMore ? page + 1 : null };
  }
}
