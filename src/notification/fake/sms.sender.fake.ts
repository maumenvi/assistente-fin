import { type Phone } from '../../domain/shared/phone.value.object.ts';
import { type SmsSender } from '../../app/verification/sms.sender.port.ts';

/** Um "SMS" guardado pelo `FakeSmsSender`, pros testes lerem sem backdoor no dominio. */
export interface SentSms {
  readonly to: string;
  readonly code: string;
}

/**
 * Adaptador falso (test double) de `SmsSender`: nao manda nada de verdade, so guarda o que
 * "enviaria" (spec 001, RF-25). Uso em desenvolvimento offline e nos testes.
 */
export class FakeSmsSender implements SmsSender {
  /** Tudo que foi "enviado" ate agora, na ordem de envio. */
  public readonly sent: SentSms[] = [];

  public async send(to: Phone, code: string): Promise<void> {
    this.sent.push({ to: to.value, code });
  }
}
