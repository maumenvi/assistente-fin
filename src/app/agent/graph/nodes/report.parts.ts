import { type MessagePart } from '../../../../domain/agent/message.part.ts';

/** Cartoes dos relatorios salvos na execucao, na ordem em que foram gravados (spec 040). */
export function reportParts(reports: readonly { readonly path: string; readonly format: 'md' | 'html' }[]): MessagePart[] {
  return reports.map((r) => ({ type: 'report_saved' as const, path: r.path, format: r.format }));
}
