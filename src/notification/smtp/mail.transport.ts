import nodemailer from 'nodemailer';
import { type SmtpEmailConfig } from '../../app/shared/notification.config.schema.ts';

/**
 * Superficie minima e estavel do transporte SMTP usada por `SmtpEmailSender` - so o que o
 * projeto precisa do nodemailer. Injetavel para testar sem abrir socket.
 */
export interface MailTransport {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
  /** Handshake com o servidor (login + STARTTLS), sem enviar nada. */
  verify(): Promise<unknown>;
}

/** Fabrica de `MailTransport` - a real usa o nodemailer; os testes passam um dublê. */
export type MailTransportFactory = (config: SmtpEmailConfig) => MailTransport;

/** `MailTransport` real: nodemailer com a config SMTP do usuario. */
export const createNodemailerTransport: MailTransportFactory = (config) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  }) as unknown as MailTransport;
