/**
 * Tamanho em bytes de `text` em UTF-8. Funcao pura, sem `Buffer`/`TextEncoder` (o Hermes do app
 * Android nao garante nenhum dos dois).
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      // par substituto (ex.: emoji) = 4 bytes
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}
