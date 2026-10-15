import { type Email } from '../../domain/shared/email.value.object.ts';

/**
 * Porta de envio de codigo de verificacao por e-mail (spec 001, RF-25).
 *
 * Injetada por DI (`notification/notification.factory.ts`); o caso de uso
 * (`RequestVerificationUseCase`) nunca sabe qual provedor esta por tras.
 */
export interface EmailSender {
  /** Envia `code` para `to`. Resolve quando o envio foi aceito pelo canal (nao entrega). */
  send(to: Email, code: string): Promise<void>;
}
