/** Por que o envio esta bloqueado agora (ou `null` se pode enviar). */
export type SendBlockReason = 'empty' | 'too_long' | 'busy' | 'offline' | 'attachment_reading' | 'attachment_blocked';

/** Maximo de caracteres de uma pergunta (igual ao do caso de uso). */
export const MAX_CHAT_CHARS = 4000;

/** Regra do botao Enviar: texto de 1 a 4000 caracteres, sem execucao em andamento, sem anexo ainda sendo lido (spec 036, FR-007) e com rede. */
export function sendBlockReason(input: { readonly text: string; readonly busy: boolean; readonly online: boolean; readonly readingAttachment?: boolean; readonly attachmentBlocked?: boolean }): SendBlockReason | null {
  const length = input.text.trim().length;
  if (length === 0) return 'empty';
  if (length > MAX_CHAT_CHARS) return 'too_long';
  if (input.busy) return 'busy';
  if (input.readingAttachment === true) return 'attachment_reading';
  if (input.attachmentBlocked === true) return 'attachment_blocked';
  if (!input.online) return 'offline';
  return null;
}
