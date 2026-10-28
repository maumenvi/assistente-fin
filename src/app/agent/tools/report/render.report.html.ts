import { type ReportBlock } from '../../../../domain/agent/report/report.block.ts';
import { type ReportSpec } from '../../../../domain/agent/report/report.spec.ts';
import { escapeHtml } from './escape.html.ts';
import { formatChartValue } from './format.chart.value.ts';
import { markdownToHtml } from './markdown.to.html.ts';
import { renderChartSvg } from './render.chart.svg.ts';

/** Paleta validada (slots 1-8 do tema categorico); claro e escuro sao passos proprios, nao inversao automatica. */
const STYLE = `
:root{color-scheme:light dark;--surface:#fcfcfb;--bg:#f4f3f0;--text-primary:#0b0b0b;--text-secondary:#52514e;--grid:#e3e2dd;--border:#dcdbd5;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s5:#e87ba4;--s6:#008300;--s7:#6250d6;--s8:#e34948}
@media (prefers-color-scheme:dark){:root{--surface:#1a1a19;--bg:#121211;--text-primary:#f0efec;--text-secondary:#c3c2b7;--grid:#3a3936;--border:#3a3936;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#008300;--s7:#9085e9;--s8:#e66767}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text-primary);font:16px/1.55 system-ui,sans-serif}
main{max-width:52rem;margin:0 auto;padding:2rem 1rem 3rem}
h1{font-size:1.75rem;margin:0 0 .25rem}h2,h3,h4,h5{margin:1.5rem 0 .5rem}
.summary{color:var(--text-secondary);margin:0 0 1.5rem;font-size:1.05rem}
section.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem 1.25rem;margin:1rem 0;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.95rem}
th,td{padding:.45rem .6rem;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
th{color:var(--text-secondary);font-weight:600;font-size:.85rem}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
figure{margin:0}figcaption{font-weight:600;margin-bottom:.5rem}
details{margin-top:.75rem;color:var(--text-secondary)}summary{cursor:pointer}
code{background:var(--bg);padding:.1rem .3rem;border-radius:4px}
footer{margin-top:2rem;color:var(--text-secondary);font-size:.85rem}
@media print{body{background:#fff}section.card{break-inside:avoid}}
`;

const NUMERIC = /^[-−]?\s?(R\$\s?)?[\d.]+(,\d+)?\s?%?$/;

function table(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  const numeric = columns.map((_, c) => rows.length > 0 && rows.every((r) => NUMERIC.test((r[c] ?? '').trim())));
  const head = columns.map((c, i) => `<th scope="col"${numeric[i] === true ? ' class="num"' : ''}>${escapeHtml(c)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((_, i) => `<td${numeric[i] === true ? ' class="num"' : ''}>${escapeHtml(r[i] ?? '')}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function block(item: ReportBlock): string {
  if (item.type === 'text') return `<section class="card">${markdownToHtml(item.markdown)}</section>`;
  if (item.type === 'table') return `<section class="card">${table(item.columns, item.rows)}</section>`;
  const data = table(['Item', 'Valor'], item.series.map((p) => [p.label, formatChartValue(p.value, item.unit)]));
  return `<section class="card"><figure><figcaption>${escapeHtml(item.title)}</figcaption>${renderChartSvg(item)}<details><summary>Ver como tabela</summary>${data}</details></figure></section>`;
}

/**
 * Relatorio `.html` autocontido (spec 040, FR-015): CSS inline com tema claro/escuro, graficos em SVG, sem script e sem recurso
 * externo (abre offline); todo texto vindo dos dados e escapado.
 */
export function renderReportHtml(spec: ReportSpec, generatedAt: Date): string {
  return [
    '<!doctype html>',
    '<html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${escapeHtml(spec.title)}</title>`,
    `<style>${STYLE}</style></head><body><main>`,
    `<h1>${escapeHtml(spec.title)}</h1>`,
    `<p class="summary">${escapeHtml(spec.summary)}</p>`,
    ...spec.blocks.map(block),
    `<footer>Gerado pelo Assistente Fin em ${escapeHtml(generatedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' }))}. Valores vindos das consultas feitas no app.</footer>`,
    '</main></body></html>',
  ].join('\n');
}
