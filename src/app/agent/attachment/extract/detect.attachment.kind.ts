import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { UnsupportedAttachmentError } from '../../../../domain/agent/attachment/errors/unsupported.attachment.error.ts';
import { type DetectedAttachment } from './detected.attachment.ts';

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean => signature.every((b, i) => bytes[i] === b);

/**
 * Detecta o tipo de um arquivo pela extensao E pela assinatura (spec 036, contracts/extraction.md): extensao desconhecida,
 * ou que nao bate com o conteudo (ex.: `.pdf` que e outra coisa), ou binario disfarcado de texto => `UnsupportedAttachmentError`;
 * arquivo vazio => `AttachmentUnreadableError('empty')`. txt/csv nao tem assinatura: so se confere que nao ha bytes nulos.
 */
export function detectAttachmentKind(name: string, bytes: Uint8Array): DetectedAttachment {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? '';
  if (!['txt', 'csv', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg'].includes(ext)) throw new UnsupportedAttachmentError();
  if (bytes.byteLength === 0) throw new AttachmentUnreadableError('empty');
  switch (ext) {
    case 'pdf':
      if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) throw new UnsupportedAttachmentError();
      return { kind: 'pdf', mediaType: 'application/pdf' };
    case 'xlsx':
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) throw new UnsupportedAttachmentError();
      return { kind: 'xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    case 'png':
      if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) throw new UnsupportedAttachmentError();
      return { kind: 'image', mediaType: 'image/png' };
    case 'jpg':
    case 'jpeg':
      if (!startsWith(bytes, [0xff, 0xd8, 0xff])) throw new UnsupportedAttachmentError();
      return { kind: 'image', mediaType: 'image/jpeg' };
    default: {
      if (bytes.subarray(0, 4096).includes(0)) throw new UnsupportedAttachmentError();
      return ext === 'csv' ? { kind: 'csv', mediaType: 'text/csv' } : { kind: 'text', mediaType: 'text/plain' };
    }
  }
}
