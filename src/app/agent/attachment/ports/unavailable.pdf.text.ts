import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { type PdfPage, type PdfTextPort } from './pdf.text.port.ts';

/** Leitor de PDF de quem nao tem um (ex.: aparelho onde o `pdfjs` nao carrega): recusa com a mensagem "este aparelho ainda nao le PDF". */
export class UnavailablePdfText implements PdfTextPort {
  public extract(_bytes: Uint8Array): Promise<readonly PdfPage[]> {
    return Promise.reject(new AttachmentUnreadableError('device'));
  }
}
