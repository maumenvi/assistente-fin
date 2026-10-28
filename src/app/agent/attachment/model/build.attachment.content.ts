import { type Attachment } from '../../../../domain/agent/attachment/attachment.ts';
import { READ_ATTACHMENT_TOOL } from '../../../../domain/agent/attachment/attachment.tool.name.ts';
import { type LlmContentPart } from '../../ports/llm/llm.content.part.ts';
import { toBase64 } from './to.base64.ts';
import { rowLine, sheetSummary } from './attachment.summary.ts';
import { sanitizeAttachmentText, sanitizeCell } from './sanitize.attachment.text.ts';

/** O que o anexo acrescenta a mensagem do usuario: texto (blocos de dado externo) e imagens. */
export interface AttachmentModelContent {
  readonly text: string;
  readonly images: readonly LlmContentPart[];
}

/** Anexo para o modelo: so o que precisa (nunca os bytes de arquivo; imagem vai em `images`). */
export type AttachmentForModel = Pick<Attachment, 'id' | 'name' | 'kind' | 'mediaType' | 'extracted' | 'bytes'>;

/** Espaco (caracteres) reservado ao aviso "cortado: use read_attachment". */
const CUT_NOTICE_RESERVE = 130;

/** Bloco de um anexo de arquivo, ate `budget` caracteres: cabecalho (sempre), depois as primeiras linhas/texto que couberem. */
function blockOf(a: AttachmentForModel, budget: number): string {
  const open = `<dado_externo origem="anexo" id="${a.id}" nome="${sanitizeCell(a.name, 80).replace(/"/g, "'")}" tipo="${a.kind}">`;
  const close = '</dado_externo>';
  const lines: string[] = [];
  // reserva espaco para o aviso de corte (acrescentado depois do orcamento)
  let used = open.length + close.length + CUT_NOTICE_RESERVE;
  let cut = false;
  const push = (line: string): boolean => {
    if (used + line.length + 1 > budget) {
      cut = true;
      return false;
    }
    lines.push(line);
    used += line.length + 1;
    return true;
  };
  const content = a.extracted;
  if (content === null) {
    push(`(sem conteúdo extraído)`);
  } else {
    for (const sheet of content.sheets) {
      push(sheetSummary(sheet));
      if (!push(`Cabeçalho: ${rowLine(sheet.header)}`)) break;
      for (const row of sheet.rows) if (!push(rowLine(row))) break;
      if (cut) break;
    }
    if (content.text !== null && content.sheets.length === 0) {
      const room = Math.max(0, budget - used - 80);
      const text = sanitizeAttachmentText(content.text);
      push(text.length <= room ? text : text.slice(0, room));
      if (text.length > room) cut = true;
    } else if (content.text !== null && !cut) {
      push('(o PDF também tem texto corrido; leia com read_attachment)');
    }
    for (const w of content.warnings) if (w.code === 'truncated') cut = true;
  }
  if (cut) lines.push(`⚠ cortado: use ${READ_ATTACHMENT_TOOL}(id="${a.id}", sheet, offset) para ler o restante`);
  return [open, ...lines, close].join('\n');
}

/**
 * Conteudo de anexos de UMA mensagem para o modelo (spec 036, contracts/model.content.md): um bloco de DADO EXTERNO por
 * anexo de arquivo (o orcamento de caracteres e dividido igualmente) e as imagens como partes `image` (so quando `withImages`).
 * O texto do anexo e sanitizado: nunca e instrucao.
 */
export function buildAttachmentContent(attachments: readonly AttachmentForModel[], budgetChars: number, withImages: boolean): AttachmentModelContent {
  const files = attachments.filter((a) => a.kind !== 'image');
  const perFile = files.length === 0 ? 0 : Math.floor(budgetChars / files.length);
  const text = files.map((a) => blockOf(a, perFile)).join('\n');
  const images: LlmContentPart[] = withImages ? attachments.filter((a) => a.kind === 'image').map((a) => ({ type: 'image', mediaType: a.mediaType, dataBase64: toBase64(a.bytes) })) : [];
  return { text, images };
}

/** Referencia de um anexo em mensagens SEGUINTES: so uma linha (o conteudo vem por `read_attachment`). */
export function attachmentReference(a: { readonly id?: string; readonly name: string; readonly kind: Attachment['kind']; readonly available?: boolean }): string {
  const name = sanitizeCell(a.name, 80);
  if (a.available === false) return `[anexo ${name} — apagado]`;
  const id = a.id === undefined ? '' : ` (id ${a.id})`;
  return `[anexo ${name}${id} — ${a.kind === 'image' ? 'imagem enviada antes' : `use ${READ_ATTACHMENT_TOOL}`}]`;
}
