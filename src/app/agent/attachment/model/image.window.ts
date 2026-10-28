import { type Attachment } from '../../../../domain/agent/attachment/attachment.ts';

/** Maximo de imagens no contexto do modelo (spec 036, contracts/model.content.md). */
export const MAX_IMAGES_IN_CONTEXT = 3;

/** Quantas mensagens com anexo depois de uma imagem ela ainda e reenviada. */
const FOLLOWING_ATTACHMENT_MESSAGES = 2;

/**
 * Imagens que seguem ao modelo no turno da mensagem `currentMessageId` (spec 036): as dela mesma e as das duas mensagens
 * COM anexo anteriores mais proximas, no maximo 3 no total (as da mensagem atual tem prioridade). Ordem cronologica.
 * `all` sao os anexos da conversa, do mais antigo ao mais novo, incluindo os da mensagem atual.
 */
export function imageWindow(all: readonly Attachment[], currentMessageId: string): Attachment[] {
  const order: string[] = [];
  for (const a of all) if (!order.includes(a.messageId)) order.push(a.messageId);
  const current = order.indexOf(currentMessageId);
  const imagesOf = (messageId: string): Attachment[] => all.filter((a) => a.messageId === messageId && a.kind === 'image');
  const own = imagesOf(currentMessageId).slice(0, MAX_IMAGES_IN_CONTEXT);
  const earlier: Attachment[] = [];
  for (let j = current - 1; j >= 0 && current - j <= FOLLOWING_ATTACHMENT_MESSAGES; j -= 1) earlier.unshift(...imagesOf(order[j] as string));
  const room = MAX_IMAGES_IN_CONTEXT - own.length;
  return [...earlier.slice(Math.max(0, earlier.length - room)), ...own];
}
