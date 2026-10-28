import { type AttachmentKind } from './attachment.kind.ts';

/**
 * Parte da mensagem do usuario que representa um anexo (spec 036). So metadados: o conteudo nunca vai na parte.
 * `available=false` depois que o anexo e apagado (a mensagem continua).
 */
export interface AttachmentPart {
  readonly type: 'attachment';
  readonly attachmentId: string;
  readonly name: string;
  readonly kind: AttachmentKind;
  readonly sizeBytes: number;
  readonly available: boolean;
}
