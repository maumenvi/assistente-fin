import { type ReportBlock } from '../../../../domain/agent/report/report.block.ts';
import { escapeHtml } from './escape.html.ts';
import { formatChartValue } from './format.chart.value.ts';

type ChartBlock = Extract<ReportBlock, { type: 'chart' }>;

const W = 640;
const FONT = 'font-family="system-ui, sans-serif" font-size="12"';
/** Fatias/series em ordem fixa (slots do tema categorico); nunca ciclam: a pizza aceita ate 8. */
const SERIES = (index: number): string => `var(--s${String((index % 8) + 1)})`;

const text = (x: number, y: number, value: string, anchor: 'start' | 'middle' | 'end', fill = 'var(--text-secondary)'): string =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" fill="${fill}" ${FONT}>${escapeHtml(value)}</text>`;

function scale(values: readonly number[]): { lo: number; hi: number } {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  return { lo, hi: hi === lo ? lo + 1 : hi };
}

function bars(block: ChartBlock): string {
  const rowH = 30;
  const left = 150;
  const right = 96;
  const { lo, hi } = scale(block.series.map((p) => p.value));
  const span = W - left - right;
  const x = (v: number): number => left + ((v - lo) / (hi - lo)) * span;
  const zero = x(0);
  const height = block.series.length * rowH + 12;
  const rows = block.series.map((point, i) => {
    const y = 6 + i * rowH;
    const end = x(point.value);
    const barX = Math.min(zero, end);
    const barW = Math.max(2, Math.abs(end - zero));
    const label = formatChartValue(point.value, block.unit);
    const valueX = point.value >= 0 ? barX + barW + 6 : barX - 6;
    return [
      `<g><title>${escapeHtml(`${point.label}: ${label}`)}</title>`,
      text(left - 8, y + 17, point.label.length > 22 ? `${point.label.slice(0, 21)}…` : point.label, 'end', 'var(--text-primary)'),
      `<rect x="${barX.toFixed(1)}" y="${String(y + 4)}" width="${barW.toFixed(1)}" height="16" rx="4" fill="var(--s1)"/>`,
      text(valueX, y + 17, label, point.value >= 0 ? 'start' : 'end', 'var(--text-primary)'),
      '</g>',
    ].join('');
  });
  return `<svg viewBox="0 0 ${String(W)} ${String(height)}" width="100%" role="img" aria-label="${escapeHtml(block.title)}">${rows.join('')}<line x1="${zero.toFixed(1)}" y1="2" x2="${zero.toFixed(1)}" y2="${String(height - 4)}" stroke="var(--grid)" stroke-width="1"/></svg>`;
}

function line(block: ChartBlock): string {
  const height = 260;
  const top = 16;
  const bottom = 44;
  const left = 78;
  const right = 20;
  const { lo, hi } = scale(block.series.map((p) => p.value));
  const n = block.series.length;
  const x = (i: number): number => (n === 1 ? left + (W - left - right) / 2 : left + (i / (n - 1)) * (W - left - right));
  const y = (v: number): number => top + (1 - (v - lo) / (hi - lo)) * (height - top - bottom);
  const grid = [0, 1, 2, 3].map((k) => {
    const v = lo + ((hi - lo) * k) / 3;
    return `<line x1="${String(left)}" x2="${String(W - right)}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>${text(left - 8, y(v) + 4, formatChartValue(v, block.unit), 'end')}`;
  });
  const every = Math.max(1, Math.ceil(n / 8));
  const labels = block.series.flatMap((p, i) => (i % every === 0 ? [text(x(i), height - bottom + 18, p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label, 'middle')] : []));
  const path = block.series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const dots = block.series.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"><title>${escapeHtml(`${p.label}: ${formatChartValue(p.value, block.unit)}`)}</title></circle>`);
  return `<svg viewBox="0 0 ${String(W)} ${String(height)}" width="100%" role="img" aria-label="${escapeHtml(block.title)}">${grid.join('')}<path d="${path}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots.join('')}${labels.join('')}</svg>`;
}

function pie(block: ChartBlock): string {
  const total = block.series.reduce((sum, p) => sum + p.value, 0);
  const cx = 110;
  const cy = 110;
  const r = 96;
  const inner = 54;
  let angle = -Math.PI / 2;
  const slices = block.series.map((p, i) => {
    const sweep = (p.value / total) * Math.PI * 2;
    const a0 = angle;
    angle += sweep;
    const tip = escapeHtml(`${p.label}: ${formatChartValue(p.value, block.unit)}`);
    if (block.series.length === 1) {
      return `<g><title>${tip}</title><circle cx="${String(cx)}" cy="${String(cy)}" r="${String((r + inner) / 2)}" fill="none" stroke="${SERIES(i)}" stroke-width="${String(r - inner)}"/></g>`;
    }
    const a1 = angle;
    const pt = (rad: number, a: number): string => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M${pt(r, a0)} A${String(r)} ${String(r)} 0 ${String(large)} 1 ${pt(r, a1)} L${pt(inner, a1)} A${String(inner)} ${String(inner)} 0 ${String(large)} 0 ${pt(inner, a0)} Z`;
    return `<path d="${d}" fill="${SERIES(i)}" stroke="var(--surface)" stroke-width="2"><title>${tip}</title></path>`;
  });
  const legend = block.series.map((p, i) => {
    const y = 28 + i * 24;
    return `<g><rect x="240" y="${String(y - 11)}" width="12" height="12" rx="3" fill="${SERIES(i)}"/>${text(260, y, `${p.label.length > 26 ? `${p.label.slice(0, 25)}…` : p.label} — ${formatChartValue(p.value, block.unit)}`, 'start', 'var(--text-primary)')}</g>`;
  });
  const height = Math.max(220, 28 + block.series.length * 24 + 8);
  return `<svg viewBox="0 0 ${String(W)} ${String(height)}" width="100%" role="img" aria-label="${escapeHtml(block.title)}">${slices.join('')}${legend.join('')}</svg>`;
}

/**
 * Grafico como SVG inline autocontido (spec 040, FR-015): sem script e sem recurso externo; cores por variaveis CSS do tema
 * (claro/escuro); `<title>` em cada marca para a dica ao passar o mouse; marcas finas, ponta de dado arredondada.
 */
export function renderChartSvg(block: ChartBlock): string {
  return block.kind === 'bar' ? bars(block) : block.kind === 'line' ? line(block) : pie(block);
}
