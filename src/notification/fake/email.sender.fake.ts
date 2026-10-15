import { type Email } from '../../domain/shared/email.value.object.ts';
import { type EmailSender } from '../../app/verification/email.sender.port.ts';

/** Um "e-mail" guardado pelo `FakeEmailSender`, pros testes lerem sem backdoor no dominio. */
export interface SentEmail {
  readonly to: string;
  readonly code: string;
}

/**
 * Adaptador falso (test double) de `EmailSender`: nao manda nada de verdade, so guarda o que
 * "enviaria" (spec 001, RF-25). Uso em desenvolvimento offline e nos testes.
 */
export class FakeEmailSender implements EmailSender {
  /** Tudo que foi "enviado" ate agora, na ordem de envio. */
  public readonly sent: SentEmail[] = [];

  public async send(to: Email, code: string): Promise<void> {
    this.sent.push({ to: to.value, code });
  }
}
