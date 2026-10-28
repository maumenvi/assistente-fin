import { type PdfPage, type PdfTextPort } from '../../app/agent/attachment/ports/pdf.text.port.ts';
import { AttachmentUnreadableError } from '../../domain/agent/attachment/errors/attachment.unreadable.error.ts';

interface PdfjsTextItem {
  readonly str?: string;
  readonly transform?: readonly number[];
  readonly width?: number;
}

/** Leitura de texto de PDF com `pdfjs-dist` (build legacy, sem renderizar): desktop (Node). Senha/PDF invalido viram erros de dominio. */
export class PdfjsPdfText implements PdfTextPort {
  public async extract(bytes: Uint8Array): Promise<readonly PdfPage[]> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), useSystemFonts: false, verbosity: 0 });
    let doc;
    try {
      doc = await task.promise;
    } catch (error) {
      await task.destroy().catch(() => undefined);
      const name = error instanceof Error ? error.name : '';
      throw new AttachmentUnreadableError(name === 'PasswordException' ? 'password' : 'corrupt');
    }
    const pages: PdfPage[] = [];
    try {
      for (let n = 1; n <= doc.numPages; n += 1) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        pages.push({
          items: (content.items as PdfjsTextItem[]).flatMap((it) => (it.str === undefined || it.transform === undefined ? [] : [{ text: it.str, x: it.transform[4] as number, y: it.transform[5] as number, width: it.width }])),
        });
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
    return pages;
  }
}
