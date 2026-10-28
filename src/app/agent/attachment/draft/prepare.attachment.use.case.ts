import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { AttachmentTooLargeError } from '../../../../domain/agent/attachment/errors/attachment.too.large.error.ts';
import { UnsupportedAttachmentError } from '../../../../domain/agent/attachment/errors/unsupported.attachment.error.ts';
import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';
import { type Clock } from '../../../shared/clock.port.ts';
import { type IdGenerator } from '../../../shared/id.generator.port.ts';
import { detectAttachmentKind } from '../extract/detect.attachment.kind.ts';
import { extractCsv } from '../extract/extract.csv.ts';
import { extractImage } from '../extract/extract.image.ts';
import { extractPdf } from '../extract/extract.pdf.ts';
import { extractTxt } from '../extract/extract.txt.ts';
import { extractXlsx } from '../extract/extract.xlsx.ts';
import { type ImageReducerPort } from '../ports/image.reducer.port.ts';
import { type PdfTextPort } from '../ports/pdf.text.port.ts';
import { type AttachmentDraftStore } from './attachment.draft.store.ts';
import { toDraftView, type AttachmentDraftView } from './attachment.draft.view.ts';
import { sanitizeAttachmentName } from './sanitize.attachment.name.ts';

/** Dependencias de `PrepareAttachmentUseCase`. A imagem e opcional: sem redutor, imagem nao e aceita. */
export interface PrepareAttachmentDeps {
  readonly drafts: AttachmentDraftStore;
  readonly pdf: PdfTextPort;
  readonly images?: ImageReducerPort | undefined;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Entrada de `prepare`: o arquivo como a borda o leu. */
export interface PrepareAttachmentInput {
  readonly userId: string;
  readonly name: string;
  readonly bytes: Uint8Array;
}

/**
 * Prepara um anexo (spec 036, contracts/attachments.ipc.md): valida o tamanho ANTES de extrair, detecta o tipo (extensao +
 * assinatura), confere a soma do usuario, le o conteudo localmente e guarda um rascunho em memoria. Nada vai a disco.
 */
export class PrepareAttachmentUseCase {
  private readonly deps: PrepareAttachmentDeps;

  public constructor(deps: PrepareAttachmentDeps) {
    this.deps = deps;
  }

  public async execute(input: PrepareAttachmentInput): Promise<AttachmentDraftView> {
    const { drafts } = this.deps;
    if (input.bytes.byteLength > ATTACHMENT_LIMITS.maxFileBytes) throw new AttachmentTooLargeError('file');
    const mine = drafts.listOf(input.userId);
    if (mine.length >= ATTACHMENT_LIMITS.maxPerMessage || mine.reduce((sum, d) => sum + d.sizeBytes, 0) + input.bytes.byteLength > ATTACHMENT_LIMITS.maxMessageBytes) {
      throw new AttachmentTooLargeError('message');
    }
    const name = sanitizeAttachmentName(input.name);
    const detected = detectAttachmentKind(name, input.bytes);
    let extracted: ExtractedContent | null = null;
    let bytes = input.bytes;
    let mediaType = detected.mediaType;
    let previewDataUrl: string | undefined;
    switch (detected.kind) {
      case 'text':
        extracted = extractTxt(bytes);
        break;
      case 'csv':
        extracted = extractCsv(bytes);
        break;
      case 'xlsx':
        extracted = extractXlsx(bytes);
        break;
      case 'pdf':
        extracted = await extractPdf(bytes, this.deps.pdf);
        break;
      case 'image': {
        if (this.deps.images === undefined) throw new UnsupportedAttachmentError();
        const image = await extractImage(bytes, detected.mediaType, this.deps.images);
        bytes = image.bytes;
        mediaType = image.mediaType;
        previewDataUrl = image.previewDataUrl;
        break;
      }
    }
    const stored = drafts.put({ draftId: this.deps.ids.next(), userId: input.userId, name, kind: detected.kind, mediaType, sizeBytes: bytes.byteLength, status: 'ready', extracted, bytes, ...(previewDataUrl === undefined ? {} : { previewDataUrl }), warnings: extracted?.warnings ?? [] });
    return toDraftView(stored);
  }
}
