import { type ReportSpec } from '../../../../domain/agent/report/report.spec.ts';

/** Nome do arquivo do relatorio: o informado (ou o titulo), sem caracteres perigosos, com a extensao do formato. */
export function reportFileName(spec: ReportSpec): string {
  const base = (spec.fileName ?? spec.title).normalize('NFC').replace(/\.(md|html?)$/i, '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, '-').replace(/^[.-]+/, '').slice(0, 80);
  return `${base === '' ? 'relatorio' : base}.${spec.format}`;
}
