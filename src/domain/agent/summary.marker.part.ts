/**
 * Marca de exibicao "Contexto resumido" no ponto do corte (spec 032, FR-019a). NAO e enviada ao
 * modelo como mensagem; o texto do resumo vem do armazenamento ao abrir o item.
 */
export interface SummaryMarkerPart {
  readonly type: 'summary_marker';
  readonly summaryId: string;
  readonly coveredFromSeq: number;
  readonly coveredToSeq: number;
}
