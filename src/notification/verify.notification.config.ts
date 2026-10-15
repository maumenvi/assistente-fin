import { type NotificationConfig } from '../app/shared/notification.config.schema.ts';
import { SmtpEmailSender } from './smtp/smtp.email.sender.ts';

/**
 * Testa uma `NotificationConfig` contra os provedores reais (spec 002, Fase 8.5) - o que o
 * botao "Testar" da tela de configuracao de envio chama. So faz handshake, nao envia nada.
 * Rejeita com o erro do provedor; quem chama traduz para `NotificationTestFailedError`.
 *
 * T3: SMTP (`transporter.verify`). T4 acrescenta o `getMe` do bot do Telegram.
 */
export async function verifyNotificationConfig(config: NotificationConfig): Promise<void> {
  if (config.email) {
    await new SmtpEmailSender(config.email).verify();
  }
}
