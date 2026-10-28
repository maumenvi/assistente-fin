import { type ReportBlock } from './report.block.ts';

/** Pedido de relatorio (spec 040): formato, titulo, resumo e ao menos um bloco. */
export interface ReportSpec {
  readonly format: 'md' | 'html';
  readonly title: string;
  readonly summary: string;
  readonly blocks: readonly ReportBlock[];
  readonly fileName?: string | undefined;
}
