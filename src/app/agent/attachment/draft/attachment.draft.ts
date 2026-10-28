import { type AttachmentKind } from '../../../../domain/agent/attachment/attachment.kind.ts';
import { type AttachmentStatus } from '../../../../domain/agent/attachment/attachment.status.ts';
import { type ContentWarning } from '../../../../domain/agent/attachment/content.warning.ts';
import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';

/** Rascunho de anexo (spec 036, data-model.md 4): so existe em memoria ate o envio. Nunca vai a disco. */
export interface AttachmentDraft {
  readonly draftId: string;
  readonly userId: string;
  readonly name: string;
  readonly kind: AttachmentKind;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly status: AttachmentStatus;
  readonly extracted: ExtractedContent | null;
  readonly bytes: Uint8Array;
  /** Miniatura de imagem (data URL) para a caixa de mensagem; so ate o envio. */
  readonly previewDataUrl?: string | undefined;
  readonly warnings: readonly ContentWarning[];
  /** Instante em que o rascunho some (1 h depois de criado), a menos que esteja preso a um envio pendente. */
  readonly expiresAt: string;
}
