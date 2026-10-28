import { type AttachmentKind } from './attachment.kind.ts';
import { type AttachmentStatus } from './attachment.status.ts';
import { type ExtractedContent } from './extracted.content.ts';

/**
 * Anexo de uma mensagem do usuario (spec 036, data-model.md 1). Vive so no aparelho de origem (fora de backup e sync).
 * `bytes` e o conteudo guardado (imagem ja reduzida); nunca vai a visoes, logs ou trace.
 */
export interface Attachment {
  readonly id: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly messageId: string;
  /** Nome do arquivo sem caminho, ate 200 caracteres. */
  readonly name: string;
  readonly kind: AttachmentKind;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly status: AttachmentStatus;
  readonly extracted: ExtractedContent | null;
  readonly bytes: Uint8Array;
  readonly createdAt: string;
}
