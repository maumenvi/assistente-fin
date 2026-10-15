const encoder = new TextEncoder();

/** Tamanho em bytes UTF-8 de um texto: o que a tela mostra antes de copiar ou compartilhar (spec 029, FR-012). */
export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}
