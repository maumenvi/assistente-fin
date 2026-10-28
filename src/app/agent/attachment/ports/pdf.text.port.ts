/** Um trecho de texto de uma pagina de PDF com a posicao (origem embaixo-esquerda, como no PDF). */
export interface PdfTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  /** Largura do trecho na pagina (unidades do PDF); `undefined` => estimada pelo tamanho do texto. */
  readonly width?: number | undefined;
}

/** Uma pagina de PDF ja lida. */
export interface PdfPage {
  readonly items: readonly PdfTextItem[];
}

/**
 * Leitura de texto de PDF (spec 036, R2), isolada para que o risco do Android fique num adaptador so. Lanca
 * `AttachmentUnreadableError('password' | 'corrupt')`.
 */
export interface PdfTextPort {
  extract(bytes: Uint8Array): Promise<readonly PdfPage[]>;
}
