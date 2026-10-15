/** Limite de exibicao de uma origem: no maximo `max` toasts por janela de `windowMs` (spec 013, RF-9a). */
export interface NotificationDisplayLimit {
  readonly max: number;
  readonly windowMs: number;
}
