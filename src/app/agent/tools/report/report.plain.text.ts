import { type ReportSpec } from '../../../../domain/agent/report/report.spec.ts';
import { formatChartValue } from './format.chart.value.ts';

/** Todo o texto do relatorio numa string, na mesma formatacao que vai para o arquivo: base da conferencia de numeros. */
export function reportPlainText(spec: ReportSpec): string {
  const lines = [spec.title, spec.summary];
  for (const block of spec.blocks) {
    if (block.type === 'text') lines.push(block.markdown);
    else if (block.type === 'table') lines.push(block.columns.join(' | '), ...block.rows.map((r) => r.join(' | ')));
    else lines.push(block.title, ...block.series.map((p) => `${p.label}: ${formatChartValue(p.value, block.unit)}`));
  }
  return lines.join('\n');
}
