import { type VerificationChannel } from '../../domain/verification/verification.channel.ts';

/** Minutos de validade do codigo - espelha `CODE_TTL_MINUTES` de `RequestVerificationUseCase`. */
const TTL_MINUTES = 15;

/** Texto pronto para o `EmailSender`/`SmsSender` real enviar (assunto so faz sentido no e-mail). */
export interface VerificationMessage {
  readonly subject: string;
  readonly body: string;
}

/**
 * Monta a mensagem que carrega o codigo de verificacao (spec 001, RF-24/RF-25; spec 002,
 * Fase 8.5). Puro e testavel - os adaptadores reais (SMTP, Telegram) so formatam o envelope.
 */
export function buildVerificationMessage(
  channel: VerificationChannel,
  code: string,
): VerificationMessage {
  const alvo = channel === 'email' ? 'e-mail' : 'telefone';
  return {
    subject: `Codigo de verificacao: ${code}`,
    body:
      `Seu codigo para verificar o ${alvo} no Finance Controller e ${code}.\n\n` +
      `Ele vale por ${TTL_MINUTES} minutos. Se voce nao pediu este codigo, ignore esta mensagem.`,
  };
}
