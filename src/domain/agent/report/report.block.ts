/** Ponto de um grafico. */
export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

/** Limites de um grafico de relatorio (spec 040, data-model). */
export const MAX_CHART_POINTS = 200;
/** Pizza com mais fatias que isto vira ilegivel: o modelo deve usar barras. */
export const MAX_PIE_SLICES = 8;

/**
 * Bloco de um relatorio (spec 040, FR-014): texto em Markdown, tabela ou grafico. O relatorio e DADOS estruturados; o app o
 * transforma em `.md`/`.html` de forma deterministica, entao o modelo nunca escreve HTML nem SVG.
 */
export type ReportBlock =
  | { readonly type: 'text'; readonly markdown: string }
  | { readonly type: 'table'; readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly type: 'chart'; readonly kind: 'bar' | 'line' | 'pie'; readonly title: string; readonly series: readonly ChartPoint[]; readonly unit: 'BRL' | 'percent' | 'count' };
