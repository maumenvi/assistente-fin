import { type ReportBlock } from '../../../../domain/agent/report/report.block.ts';
import { type ReportSpec } from '../../../../domain/agent/report/report.spec.ts';
import { formatChartValue } from './format.chart.value.ts';

const cell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const BAR_WIDTH = 30;

function table(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return [`| ${columns.map(cell).join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${columns.map((_, i) => cell(r[i] ?? '')).join(' | ')} |`)].join('\n');
}

/** Barras ASCII proporcionais ao maior valor (so positivos; negativos ficam sem barra e o valor continua escrito). */
function asciiBars(item: Extract<ReportBlock, { type: 'chart' }>): string {
  const max = Math.max(...item.series.map((p) => p.value), 0) || 1;
  const width = Math.max(...item.series.map((p) => p.label.length));
  const lines = item.series.map((p) => `${p.label.padEnd(width)} ${'█'.repeat(p.value > 0 ? Math.max(1, Math.round((p.value / max) * BAR_WIDTH)) : 0)} ${formatChartValue(p.value, item.unit)}`);
  return ['```', ...lines, '```'].join('\n');
}

function block(item: ReportBlock): string {
  if (item.type === 'text') return item.markdown;
  if (item.type === 'table') return table(item.columns, item.rows);
  const data = table(['Item', 'Valor'], item.series.map((p) => [p.label, formatChartValue(p.value, item.unit)]));
  return `### ${item.title}\n\n${item.kind === 'bar' ? asciiBars(item) : data}`;
}

/** Relatorio `.md` (spec 040, FR-015): tabelas Markdown e grafico de barras em ASCII; linha e pizza viram tabela. */
export function renderReportMarkdown(spec: ReportSpec, generatedAt: Date): string {
  return [`# ${spec.title}`, `> ${spec.summary}`, ...spec.blocks.map(block), `_Gerado pelo Assistente Fin em ${generatedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}._`].join('\n\n') + '\n';
}
