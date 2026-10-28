import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { type ContentWarning } from '../../../../domain/agent/attachment/content.warning.ts';
import { type ExtractedContent } from '../../../../domain/agent/attachment/extracted.content.ts';
import { decodeTextBytes } from './decode.text.bytes.ts';

/** Extrai um .txt: texto puro (UTF-8, senao Latin-1) com as linhas preservadas; acima de 200 mil caracteres corta e avisa. */
export function extractTxt(bytes: Uint8Array): ExtractedContent {
  const full = decodeTextBytes(bytes).replace(/\r\n?/g, '\n');
  if (full.trim() === '') throw new AttachmentUnreadableError('empty');
  const truncated = full.length > ATTACHMENT_LIMITS.maxTextChars;
  const text = truncated ? full.slice(0, ATTACHMENT_LIMITS.maxTextChars) : full;
  const warnings: ContentWarning[] = truncated ? [{ code: 'truncated', detail: { chars: full.length, kept: text.length } }] : [];
  return { kind: 'text', text, sheets: [], warnings, stats: { rows: text.split('\n').length, chars: text.length } };
}
