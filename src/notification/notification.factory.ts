import { type EmailSender } from '../app/verification/email.sender.port.ts';
import { type SmsSender } from '../app/verification/sms.sender.port.ts';
import { type NotificationConfig } from '../app/shared/notification.config.schema.ts';
import { SmtpEmailSender } from './smtp/smtp.email.sender.ts';
import { FakeEmailSender } from './fake/email.sender.fake.ts';
import { FakeSmsSender } from './fake/sms.sender.fake.ts';

/**
 * Resolve os adaptadores de envio de verificacao a partir da config, por injecao de
 * dependencia (spec 001, RF-25) - mesmo padrao de `database/database.factory.ts`. Ponto
 * unico que decide "qual provedor"; dominio e casos de uso nunca chamam isto, so a raiz de
 * composicao (`composition/container.ts`).
 *
 * Sem o bloco do canal na config (`undefined`), devolve o adaptador `fake` (guarda o codigo,
 * sem rede) - o padrao em dev/teste e enquanto o usuario nao configura um provedor. O canal
 * do "telefone" via Telegram entra na tarefa 8.5-T4.
 */
export function createEmailSender(config: NotificationConfig | undefined): EmailSender {
  return config?.email ? new SmtpEmailSender(config.email) : new FakeEmailSender();
}

/** Ver `createEmailSender` - canal do "telefone", entregue pelo Telegram (spec 002, Fase 8.5). */
export function createSmsSender(config: NotificationConfig | undefined): SmsSender {
  return new FakeSmsSender();
}
