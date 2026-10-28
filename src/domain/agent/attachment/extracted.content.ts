import { type AttachmentKind } from './attachment.kind.ts';
import { type ContentWarning } from './content.warning.ts';
import { type ExtractedSheet } from './extracted.sheet.ts';

/** O que o assistente le de um anexo (spec 036, data-model.md 2). Imagem nao tem conteudo extraido. */
export interface ExtractedContent {
  readonly kind: AttachmentKind;
  /** txt e pdf: texto corrido (pdf: por pagina separado por linha em branco). */
  readonly text: string | null;
  readonly sheets: readonly ExtractedSheet[];
  readonly warnings: readonly ContentWarning[];
  readonly stats: { readonly rows: number; readonly chars: number; readonly pages?: number };
}
