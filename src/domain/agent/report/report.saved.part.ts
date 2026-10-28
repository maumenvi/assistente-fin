/** Cartao "relatorio salvo" na conversa (spec 040): guarda so o caminho e o formato; abrir e acao da pessoa. */
export interface ReportSavedPart {
  readonly type: 'report_saved';
  readonly path: string;
  readonly format: 'md' | 'html';
}
