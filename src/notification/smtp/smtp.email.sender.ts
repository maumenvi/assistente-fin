import { type Email } from '../../domain/shared/email.value.object.ts';
import { type EmailSender } from '../../app/verification/email.sender.port.ts';
import { buildVerificationMessage } from '../../app/verification/verification.message.ts';
import { type SmtpEmailConfig } from '../../app/shared/notification.config.schema.ts';
import {
  createNodemailerTransport,
  type MailTransport,
  type MailTransportFactory,
} from './mail.transport.ts';

/**
 * Adaptador real de `EmailSender` por SMTP (spec 001, RF-25; spec 002, Fase 8.5-T3).
 *
 * O transporte e criado sob demanda (primeira chamada) e reaproveitado - `createContainer`
 * roda a cada conexao/troca de config, entao instanciar isto e barato. `verify()` faz so o
 * handshake (a tela "Testar" usa). O `code` vira corpo via `buildVerificationMessage`.
 */
export class SmtpEmailSender implements EmailSender {
  private readonly config: SmtpEmailConfig;
  private readonly createTransport: MailTransportFactory;
  private transport: MailTransport | null = null;

  public constructor(
    config: SmtpEmailConfig,
    createTransport: MailTransportFactory = createNodemailerTransport,
  ) {
    this.config = config;
    this.createTransport = createTransport;
  }

  public async send(to: Email, code: string): Promise<void> {
    const message = buildVerificationMessage('email', code);
    await this.transporter().sendMail({
      from: this.config.from,
      to: to.value,
      subject: message.subject,
      text: message.body,
    });
  }

  /** Testa a conexao (login + cifra) sem enviar - para a tela de configuracao. */
  public async verify(): Promise<void> {
    await this.transporter().verify();
  }

  private transporter(): MailTransport {
    if (!this.transport) {
      this.transport = this.createTransport(this.config);
    }
    return this.transport;
  }
}
