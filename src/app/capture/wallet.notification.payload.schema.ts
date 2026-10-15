import { z } from 'zod';

/** Pacote do Google Wallet - o nativo ja filtra, e a fronteira confere de novo. */
export const WALLET_PACKAGE = 'com.google.android.apps.walletnfcrel';

/**
 * Payload que o `NotificationListenerService` entrega ao JS (spec 022, T133; constitution III),
 * validado antes do parser.
 */
export const walletNotificationPayloadSchema = z.object({
  packageName: z.literal(WALLET_PACKAGE),
  postTime: z.coerce.number().int().positive(),
  title: z.string().max(500).default(''),
  text: z.string().max(2000).default(''),
  /** `StatusBarNotification.key`: igual na postagem e nas atualizacoes da mesma notificacao (spec 027, R1). */
  notificationKey: z.string().max(300).optional(),
  /** `Notification.when` (ms): instante da compra definido pelo Wallet (spec 027, R1). */
  when: z.coerce.number().int().min(0).optional(),
  /** Resumo de grupo: so vai para o log de diagnostico, nunca vira captura (spec 027). */
  groupSummary: z.coerce.boolean().default(false),
});
