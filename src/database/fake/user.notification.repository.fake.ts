import { type UserNotification } from '../../domain/user-notification/user.notification.entity.ts';
import { type UserNotificationRepository } from '../../app/user-notification/user.notification.repository.port.ts';
import { type UserNotificationPageRequest } from '../../app/user-notification/user.notification.page.request.ts';

/**
 * `UserNotificationRepository` em memoria (spec 013). A reivindicacao e sincrona dentro do
 * metodo (sem `await` entre ler e marcar), entao chamadas concorrentes nunca devolvem a mesma.
 */
export class FakeUserNotificationRepository implements UserNotificationRepository {
  private readonly byId = new Map<string, UserNotification>();

  public async save(notification: UserNotification): Promise<void> {
    this.byId.set(notification.id, notification);
  }

  public async findById(userId: string, id: string): Promise<UserNotification | null> {
    const found = this.byId.get(id);
    return found && found.userId === userId ? found : null;
  }

  public async listByUser(
    userId: string,
    request: UserNotificationPageRequest,
  ): Promise<{ items: UserNotification[]; total: number }> {
    const all = this.ofUser(userId)
      .filter((n) => !request.unreadOnly || !n.isRead)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const start = (request.page - 1) * request.pageSize;
    return { items: all.slice(start, start + request.pageSize), total: all.length };
  }

  public async claimUndelivered(userId: string, now: Date, ids?: readonly string[]): Promise<UserNotification[]> {
    const claimed = this.ofUser(userId)
      .filter((n) => n.isPendingDelivery && (ids === undefined || ids.includes(n.id)))
      .map((n) => n.markDelivered(now));
    for (const n of claimed) this.byId.set(n.id, n);
    return claimed;
  }

  public async countUnread(userId: string): Promise<number> {
    return this.ofUser(userId).filter((n) => !n.isRead).length;
  }

  public async countBySourceSince(userId: string, source: string, since: Date): Promise<number> {
    return this.ofUser(userId).filter((n) => n.source === source && n.createdAt.getTime() >= since.getTime()).length;
  }

  private ofUser(userId: string): UserNotification[] {
    return [...this.byId.values()].filter((n) => n.userId === userId);
  }
}
