import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { type ImageReducerPort } from '../ports/image.reducer.port.ts';
import { toBase64 } from '../model/to.base64.ts';

/** Lado maior da miniatura da caixa de mensagem. */
export const PREVIEW_SIDE_PX = 160;

/** Imagem pronta para o rascunho: reduzida (sem EXIF) e com miniatura. */
export interface ExtractedImage {
  readonly bytes: Uint8Array;
  readonly mediaType: 'image/jpeg';
  readonly previewDataUrl: string;
}

/**
 * Prepara uma imagem (spec 036, R5): reduz para JPEG com o lado maior ate 2 000 px (descarta EXIF/localizacao) e gera a
 * miniatura da caixa de mensagem. Imagem ilegivel => `AttachmentUnreadableError('corrupt')` do redutor.
 */
export async function extractImage(bytes: Uint8Array, mediaType: string, reducer: ImageReducerPort): Promise<ExtractedImage> {
  const reduced = await reducer.reduce(bytes, mediaType, ATTACHMENT_LIMITS.maxImageSidePx);
  const preview = await reducer.reduce(reduced.bytes, reduced.mediaType, PREVIEW_SIDE_PX);
  return { bytes: reduced.bytes, mediaType: reduced.mediaType, previewDataUrl: `data:${preview.mediaType};base64,${toBase64(preview.bytes)}` };
}
