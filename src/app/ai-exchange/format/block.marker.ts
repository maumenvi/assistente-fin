import { AGENT_FORMAT_VERSION } from './format.version.ts';

/** Palavra que abre todo bloco devolvido pelo agente (spec 029, R1). */
export const BLOCK_MARKER_WORD = 'FINCTRL-IMPORT';

/** Marca completa de uma versao do formato, ex.: `FINCTRL-IMPORT v1`. */
export function blockMarker(version: number = AGENT_FORMAT_VERSION): string {
  return `${BLOCK_MARKER_WORD} v${version}`;
}
