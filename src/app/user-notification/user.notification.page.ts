import { type UserNotification } from '../../domain/user-notification/user.notification.entity.ts';

/** Pagina do historico de notificacoes (spec 013, RF-7a), no mesmo formato das listas do MCP. */
export interface UserNotificationPage {
  readonly items: readonly UserNotification[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasMore: boolean;
  /** `page + 1` quando `hasMore`; `null` na ultima pagina. */
  readonly nextPage: number | null;
}
