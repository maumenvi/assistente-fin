/** Pagina pedida na listagem de notificacoes (spec 013, RF-7a): `page` comeca em 1. */
export interface UserNotificationPageRequest {
  readonly page: number;
  readonly pageSize: number;
  /** So as nao lidas. */
  readonly unreadOnly: boolean;
}
