import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';

/** Nome do arquivo sem caminho nem caracteres de controle, ate 200 caracteres; vazio vira "anexo". */
export function sanitizeAttachmentName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, ATTACHMENT_LIMITS.maxNameChars);
  return clean === '' ? 'anexo' : clean;
}
