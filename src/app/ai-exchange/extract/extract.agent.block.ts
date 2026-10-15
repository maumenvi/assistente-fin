import { AiBlockInvalidError } from '../errors/ai.block.invalid.error.ts';
import { AiBlockNotFoundError } from '../errors/ai.block.not.found.error.ts';
import { AiBlockVersionError } from '../errors/ai.block.version.error.ts';
import { AGENT_FORMAT_VERSION } from '../format/format.version.ts';
import { BLOCK_MARKER_WORD } from '../format/block.marker.ts';
import { EXAMPLE_BATCH_ID } from '../format/example.batch.id.ts';

/** Marca no inicio de uma linha (com recuo opcional), como aparece no bloco de codigo copiado do chat. */
const MARKER_LINE = new RegExp(`^[ \\t]*${BLOCK_MARKER_WORD}`, 'gm');

/** Troca aspas tipograficas e remove o BOM, desvios comuns de copia entre apps (spec 029, R1). */
function normalize(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'");
}

/**
 * Le o primeiro objeto JSON balanceado a partir de `start` (uma chave de abertura), respeitando
 * strings e escapes. Devolve o texto do objeto, ou `null` se o texto acabar antes de fechar.
 */
function readBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

/** Posicao (linha e coluna, base 1) de um indice, para a mensagem de erro. */
function position(text: string, index: number): string {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return `linha ${line}, coluna ${column}`;
}

/**
 * Extrai o objeto JSON do bloco `FINCTRL-IMPORT v<N>` do texto da area de transferencia ou do
 * arquivo recebido (spec 029, R1, FR-016, FR-020). Tolera cerca de codigo, linguagem, texto antes
 * e depois e aspas tipograficas; nao aceita virgula final, comentario nem aspas simples (o erro
 * indica a posicao). So devolve o objeto lido: a validacao do conteudo e `parseAgentBlock`.
 *
 * @throws AiBlockNotFoundError sem marca no texto.
 * @throws AiBlockVersionError versao ausente ou diferente da suportada.
 * @throws AiBlockInvalidError JSON malformado, incompleto ou com mais de um objeto.
 */
export function extractAgentBlock(rawText: string): unknown {
  const text = normalize(rawText);
  // so vale a marca no comeco de uma linha: mencoes no meio de um texto (como nas instrucoes) nao contam
  const markers = [...text.matchAll(MARKER_LINE)];
  if (markers.length === 0) {
    throw new AiBlockNotFoundError();
  }
  if (markers.length > 1) {
    throw new AiBlockInvalidError([{ opIndex: -1, path: '', message: 'ha mais de um bloco; devolva um unico bloco' }]);
  }
  const markerIndex = markers[0]!.index + markers[0]![0].indexOf(BLOCK_MARKER_WORD);

  const afterWord = markerIndex + BLOCK_MARKER_WORD.length;
  const lineEnd = text.indexOf('\n', afterWord);
  const markerLine = text.slice(afterWord, lineEnd === -1 ? text.length : lineEnd);
  const versionMatch = /^\s+v(\d+)\b/.exec(markerLine);
  if (versionMatch === null || Number(versionMatch[1]) !== AGENT_FORMAT_VERSION) {
    throw new AiBlockVersionError((versionMatch?.[0] ?? markerLine).trim() || 'ausente');
  }

  const objectStart = text.indexOf('{', afterWord + markerLine.length);
  if (objectStart === -1) {
    throw new AiBlockInvalidError([{ opIndex: -1, path: '', message: 'depois da marca falta o objeto JSON' }]);
  }
  const objectText = readBalancedObject(text, objectStart);
  if (objectText === null) {
    throw new AiBlockInvalidError([{ opIndex: -1, path: '', message: 'o objeto JSON esta incompleto (copia cortada?)' }]);
  }

  try {
    const parsed = JSON.parse(objectText) as unknown;
    // o bloco de exemplo das nossas instrucoes, copiado de volta por engano, nao e um bloco do agente
    if (typeof parsed === 'object' && parsed !== null && (parsed as { batchId?: unknown }).batchId === EXAMPLE_BATCH_ID) {
      throw new AiBlockNotFoundError();
    }
    return parsed;
  } catch (error) {
    if (error instanceof AiBlockNotFoundError) throw error;
    const detail = error instanceof Error ? error.message : 'JSON invalido';
    const at = /position (\d+)/.exec(detail);
    const where = at === null ? '' : ` (${position(objectText, Number(at[1]))})`;
    throw new AiBlockInvalidError([{ opIndex: -1, path: '', message: `JSON invalido${where}: sem virgula final, comentario ou aspas simples` }]);
  }
}
