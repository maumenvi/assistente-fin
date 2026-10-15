import { type UserNotification } from '../../domain/user-notification/user.notification.entity.ts';
import { type UserNotificationPageRequest } from './user.notification.page.request.ts';

/**
 * Porta de persistencia das notificacoes do usuario (spec 013, RF-6..RF-7a, RF-9a, RF-11a,
 * RF-13a). Todas as operacoes sao no escopo do usuario.
 */
export interface UserNotificationRepository {
  /** Insere ou atualiza (ex.: `readAt`). */
  save(notification: UserNotification): Promise<void>;
  /** `null` se nao existe ou e de outro usuario. */
  findById(userId: string, id: string): Promise<UserNotification | null>;
  /** Pagina do historico, mais recentes primeiro; `total` e antes da paginacao. */
  listByUser(
    userId: string,
    request: UserNotificationPageRequest,
  ): Promise<{ readonly items: UserNotification[]; readonly total: number }>;
  /**
   * Marca `deliveredAt = now` nas pendentes do usuario (so nos `ids`, se informados) e devolve
   * APENAS as que esta chamada marcou - duas chamadas concorrentes nunca devolvem a mesma
   * notificacao (exibir no maximo uma vez, RF-11a, research R5).
   */
  claimUndelivered(userId: string, now: Date, ids?: readonly string[]): Promise<UserNotification[]>;
  /** Quantas nao lidas o usuario tem (contador do menu, RF-13a). */
  countUnread(userId: string): Promise<number>;
  /** Quantas da origem com `createdAt >= since` (limite de exibicao, RF-9a). */
  countBySourceSince(userId: string, source: string, since: Date): Promise<number>;
}
