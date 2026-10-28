/** Caractere de substituicao devolvido para bytes que nao formam UTF-8 valido. */
const REPLACEMENT = '�';

/** Quantos bytes tem a sequencia que comeca neste byte (0 = byte que nao pode iniciar sequencia). */
function sequenceLength(lead: number): number {
  if (lead < 0x80) return 1;
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0;
}

/** Indice onde comeca uma sequencia incompleta no fim dos bytes (ou o tamanho, se nao ha). */
function incompleteTailStart(bytes: Uint8Array): number {
  const length = bytes.length;
  for (let i = length - 1; i >= Math.max(0, length - 3); i -= 1) {
    const byte = bytes[i] as number;
    if (byte >= 0x80 && byte <= 0xbf) continue;
    const needed = sequenceLength(byte);
    return needed > length - i ? i : length;
  }
  return length;
}

/** Decodifica bytes que ja nao terminam no meio de uma sequencia; invalidos viram U+FFFD (1 byte cada). */
function decodeComplete(bytes: Uint8Array): string {
  const parts: string[] = [];
  let run = '';
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i] as number;
    if (lead < 0x80) {
      run += String.fromCharCode(lead);
      i += 1;
      continue;
    }
    const needed = sequenceLength(lead);
    let codePoint = -1;
    if (needed > 1 && i + needed <= bytes.length) {
      const b1 = bytes[i + 1] as number;
      const b2 = needed > 2 ? (bytes[i + 2] as number) : 0x80;
      const b3 = needed > 3 ? (bytes[i + 3] as number) : 0x80;
      const isCont = (b: number): boolean => b >= 0x80 && b <= 0xbf;
      const secondOk =
        lead === 0xe0 ? b1 >= 0xa0 && b1 <= 0xbf : lead === 0xed ? b1 >= 0x80 && b1 <= 0x9f
        : lead === 0xf0 ? b1 >= 0x90 && b1 <= 0xbf : lead === 0xf4 ? b1 >= 0x80 && b1 <= 0x8f : isCont(b1);
      if (secondOk && isCont(b2) && isCont(b3)) {
        if (needed === 2) codePoint = ((lead & 0x1f) << 6) | (b1 & 0x3f);
        else if (needed === 3) codePoint = ((lead & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
        else codePoint = ((lead & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      }
    }
    if (codePoint >= 0) {
      run += String.fromCodePoint(codePoint);
      i += needed;
    } else {
      run += REPLACEMENT;
      i += 1;
    }
    if (run.length > 8192) {
      parts.push(run);
      run = '';
    }
  }
  parts.push(run);
  return parts.join('');
}

/**
 * Decodificador UTF-8 incremental (spec 031, D4), sem `TextDecoder` (nao e garantido em stream no
 * Hermes). Um caractere multibyte partido entre dois chunks espera o resto; `flush` converte uma
 * sequencia que nunca completou em U+FFFD.
 */
export class Utf8StreamDecoder {
  private pending: Uint8Array = new Uint8Array(0);

  /** Devolve apenas o texto ja completo; guarda os bytes de uma sequencia ainda incompleta. */
  public decode(chunk: Uint8Array): string {
    let bytes = chunk;
    if (this.pending.length > 0) {
      bytes = new Uint8Array(this.pending.length + chunk.length);
      bytes.set(this.pending, 0);
      bytes.set(chunk, this.pending.length);
    }
    const cut = incompleteTailStart(bytes);
    this.pending = bytes.slice(cut);
    return decodeComplete(bytes.subarray(0, cut));
  }

  /** Fim do stream: uma sequencia incompleta vira um unico U+FFFD. */
  public flush(): string {
    const hadPending = this.pending.length > 0;
    this.pending = new Uint8Array(0);
    return hadPending ? REPLACEMENT : '';
  }
}
