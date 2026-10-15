import { BLOCK_MARKER_WORD } from '../format/block.marker.ts';

const MARKER_LINE = new RegExp(`^[ \\t]*${BLOCK_MARKER_WORD}`, 'm');

/**
 * Verificacao barata antes de qualquer parse (spec 029, R9): o texto da area de transferencia so
 * vira candidato a bloco se a marca abrir uma linha. Roda a cada volta ao primeiro plano.
 */
export function quickMarkerCheck(text: string | null): boolean {
  return text !== null && MARKER_LINE.test(text);
}
