import { type AttachmentKind } from '../../../../domain/agent/attachment/attachment.kind.ts';

/** Tipo detectado de um arquivo: o tipo do anexo e o tipo MIME normalizado. */
export interface DetectedAttachment {
  readonly kind: AttachmentKind;
  readonly mediaType: string;
}
