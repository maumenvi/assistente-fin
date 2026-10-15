import { type Phone } from '../../domain/shared/phone.value.object.ts';

/**
 * Porta de envio de codigo de verificacao por SMS (spec 001, RF-25).
 *
 * Injetada por DI (`notification/notification.factory.ts`); o caso de uso
 * (`RequestVerificationUseCase`) nunca sabe qual provedor esta por tras.
 */
export interface SmsSender {
  /** Envia `code` para `to`. Resolve quando o envio foi aceito pelo canal (nao entrega). */
  send(to: Phone, code: string): Promise<void>;
}
