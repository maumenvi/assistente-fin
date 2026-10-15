import { z } from 'zod';

/**
 * Configuracao de envio dos codigos de verificacao (spec 001, RF-25; spec 002, Fase 8.5).
 *
 * Cada canal e opcional: bloco ausente => o `notification.factory` devolve o adaptador
 * `fake` (guarda o codigo, sem rede) - o comportamento padrao em dev/teste e enquanto o
 * usuario nao configura um provedor real. Validada na fronteira (rule 11): ao chegar do
 * renderer (`notification.set`) e ao ser lida decifrada do disco.
 */

/** Envio de e-mail por SMTP (nodemailer). `pass` e segredo - nunca volta ao renderer em claro. */
export const smtpEmailConfigSchema = z.object({
  host: z.string().trim().min(1, 'informe o servidor SMTP'),
  port: z.coerce.number().int().min(1).max(65535),
  /** `true` = TLS implicito (porta 465); `false` = STARTTLS (587) ou sem cifra. */
  secure: z.boolean(),
  user: z.string().trim().min(1, 'informe o usuario SMTP'),
  pass: z.string().min(1, 'informe a senha SMTP'),
  /** Remetente: `no-reply@dominio.com` ou `Nome <no-reply@dominio.com>`. */
  from: z.string().trim().min(1, 'informe o remetente'),
});

/** Config de e-mail ja validada. */
export type SmtpEmailConfig = z.infer<typeof smtpEmailConfigSchema>;

/** Envio pelo bot do Telegram (spec 002, Fase 8.5-T4). O `botToken` do BotFather e segredo. */
export const telegramConfigSchema = z.object({
  botToken: z.string().trim().min(1, 'informe o token do bot'),
});

/** Config do Telegram ja validada. */
export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

/** Config de envio inteira - cada canal opcional. */
export const notificationConfigSchema = z.object({
  email: smtpEmailConfigSchema.optional(),
  telegram: telegramConfigSchema.optional(),
});

/** Config de envio ja validada. */
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
