import { type AttachmentKind } from '../../../../domain/agent/attachment/attachment.kind.ts';
import { type AttachmentStatus } from '../../../../domain/agent/attachment/attachment.status.ts';
import { type ContentWarning } from '../../../../domain/agent/attachment/content.warning.ts';
import { type AttachmentDraft } from './attachment.draft.ts';

/** O rascunho como a tela o recebe: sem bytes nem texto extraido; so metadados, resumo e prévia de imagem. */
export interface AttachmentDraftView {
  readonly draftId: string;
  readonly name: string;
  readonly kind: AttachmentKind;
  readonly sizeBytes: number;
  readonly status: AttachmentStatus;
  readonly previewDataUrl?: string;
  readonly warnings: readonly ContentWarning[];
  /** Resumo curto para o chip: linhas lidas, paginas ou numero de abas (sem conteudo). */
  readonly summary: { readonly rows?: number; readonly sheets?: number; readonly pages?: number };
}

/** Rascunho -> visao da tela. */
export function toDraftView(draft: AttachmentDraft): AttachmentDraftView {
  const stats = draft.extracted?.stats;
  return {
    draftId: draft.draftId,
    name: draft.name,
    kind: draft.kind,
    sizeBytes: draft.sizeBytes,
    status: draft.status,
    ...(draft.previewDataUrl === undefined ? {} : { previewDataUrl: draft.previewDataUrl }),
    warnings: draft.warnings,
    summary: {
      ...(stats === undefined ? {} : { rows: stats.rows, ...(stats.pages === undefined ? {} : { pages: stats.pages }) }),
      ...(draft.extracted !== null && draft.extracted.sheets.length > 1 ? { sheets: draft.extracted.sheets.length } : {}),
    },
  };
}
