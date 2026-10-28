import { type MessagePart } from '../../../domain/agent/message.part.ts';

/** Avisos de chave/credito (spec 035) substituem o texto generico do erro: so um dos dois aparece. */
export function noticeReplacesError(parts: readonly MessagePart[]): boolean {
  return parts.some((p) => p.type === 'notice' && (p.kind === 'key_rejected' || p.kind === 'key_expired' || p.kind === 'quota_exhausted'));
}
