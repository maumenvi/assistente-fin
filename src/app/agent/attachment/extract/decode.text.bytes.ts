/** Decodifica UTF-8 estrito; devolve `null` se os bytes nao forem UTF-8 valido. Sem `TextDecoder` (roda no Hermes). */
function decodeUtf8(bytes: Uint8Array): string | null {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i] as number;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
      continue;
    }
    const len = b >= 0xf0 && b < 0xf8 ? 4 : b >= 0xe0 ? 3 : b >= 0xc2 && b < 0xe0 ? 2 : 0;
    if (len === 0 || i + len > bytes.length) return null;
    let code = len === 2 ? b & 0x1f : len === 3 ? b & 0x0f : b & 0x07;
    for (let k = 1; k < len; k += 1) {
      const c = bytes[i + k] as number;
      if ((c & 0xc0) !== 0x80) return null;
      code = (code << 6) | (c & 0x3f);
    }
    out += String.fromCodePoint(code);
    i += len;
  }
  return out;
}

/** Bytes 0x80-0x9F do Windows-1252 que nao sao controle no Latin-1 (os mais comuns). */
const CP1252: Readonly<Record<number, string>> = { 0x80: '€', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x96: '–', 0x97: '—' };

/**
 * Texto de um arquivo: UTF-8 (com ou sem BOM) e, se nao for valido, Windows-1252/Latin-1 (extratos de banco antigos).
 * Funcao pura e portavel (sem `TextDecoder`, `Buffer` ou `node:*`).
 */
export function decodeTextBytes(bytes: Uint8Array): string {
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  const utf8 = decodeUtf8(body);
  if (utf8 !== null) return utf8;
  let out = '';
  for (const b of body) out += CP1252[b] ?? String.fromCharCode(b);
  return out;
}
