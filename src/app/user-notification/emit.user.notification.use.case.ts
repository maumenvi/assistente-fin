import { UserNotification } from '../../domain/user-notification/user.notification.entity.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type UserNotificationDeliveryPort } from './user.notification.delivery.port.ts';
import { type NotificationDisplayLimit } from './notification.display.limit.ts';
import { NOTIFICATION_DISPLAY_LIMITS } from './notification.display.limits.ts';
import { emitUserNotificationInputSchema } from './emit.user.notification.input.schema.ts';
import { parseUserNotificationInput } from './parse.user.notification.input.ts';

/**
 * Caso de uso "emitir notificacao" (spec 013, RF-5, RF-9a, research R3/R12): unica porta de
 * entrada de qualquer origem. Valida, aplica o limite de exibicao da origem (acima dele a
 * notificacao nasce ja entregue - salva, mas sem toast), persiste e SO DEPOIS entrega pela porta.
 * Uma falha na entrega nunca desfaz a emissao.
 */
export class EmitUserNotificationUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly delivery: UserNotificationDeliveryPort;
  private readonly limits: Readonly<Record<string, NotificationDisplayLimit>>;

  public constructor(
    database: Database,
    ids: IdGenerator,
    clock: Clock,
    delivery: UserNotificationDeliveryPort,
    limits: Readonly<Record<string, NotificationDisplayLimit>> = NOTIFICATION_DISPLAY_LIMITS,
  ) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
    this.delivery = delivery;
    this.limits = limits;
  }

  public async execute(rawInput: unknown): Promise<UserNotification> {
    const input = parseUserNotificationInput(emitUserNotificationInputSchema, rawInput, 'emitir notificacao');
    const now = this.clock.now();
    const notification = UserNotification.create({
      id: this.ids.next(),
      userId: input.userId,
      source: input.source,
      title: input.title ?? null,
      message: input.message,
      now,
      suppressed: await this.isOverLimit(input.userId, input.source, now),
    });
    await this.database.userNotifications.save(notification);
    try {
      this.delivery.deliver(notification);
    } catch {
      // a exibicao e best-effort: a notificacao ja esta no historico (RF-6)
    }
    return notification;
  }

  /** `true` quando a origem tem limite e ele ja foi atingido na janela (RF-9a). */
  private async isOverLimit(userId: string, source: string, now: Date): Promise<boolean> {
    const limit = Object.hasOwn(this.limits, source) ? this.limits[source] : undefined;
    if (limit === undefined) return false;
    const since = new Date(now.getTime() - limit.windowMs);
    return (await this.database.userNotifications.countBySourceSince(userId, source, since)) >= limit.max;
  }
}
