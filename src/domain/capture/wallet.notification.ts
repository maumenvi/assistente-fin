/** Notificacao do Google Wallet ja filtrada pelo pacote no nativo (spec 022, R9). */
export interface WalletNotification {
  readonly packageName: string;
  /** Epoch em ms (`StatusBarNotification.postTime`). */
  readonly postTime: number;
  readonly title: string;
  readonly text: string;
  /** `StatusBarNotification.key` - estavel entre postagem e atualizacoes (spec 027, R1). Ausente em nativo antigo. */
  readonly notificationKey?: string | undefined;
  /** `Notification.when` em ms - instante da compra (spec 027, R1). 0/ausente = desconhecido. */
  readonly when?: number | undefined;
}
