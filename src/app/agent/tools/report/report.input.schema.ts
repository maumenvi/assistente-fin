import { z } from 'zod';
import { MAX_CHART_POINTS, MAX_PIE_SLICES } from '../../../../domain/agent/report/report.block.ts';

const point = z.object({ label: z.string().trim().min(1).max(80), value: z.number().finite() });

const chart = z
  .object({
    type: z.literal('chart'),
    kind: z.enum(['bar', 'line', 'pie']).describe('bar compara categorias; line mostra evolução no tempo; pie mostra partes de um todo (até 8 fatias positivas).'),
    title: z.string().trim().min(1).max(120),
    series: z.array(point).min(1).max(MAX_CHART_POINTS),
    unit: z.enum(['BRL', 'percent', 'count']).describe('BRL = valores em reais (ex.: 1234.56); percent; count.'),
  })
  .refine((c) => c.kind !== 'pie' || (c.series.length <= MAX_PIE_SLICES && c.series.every((p) => p.value > 0)), {
    message: `pizza aceita ate ${String(MAX_PIE_SLICES)} fatias, todas positivas; use barras`,
  });

const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), markdown: z.string().trim().min(1).max(8000) }),
  z.object({
    type: z.literal('table'),
    columns: z.array(z.string().trim().max(80)).min(1).max(12),
    rows: z.array(z.array(z.string().max(300)).max(12)).max(500),
  }),
  chart,
]);

export const reportSpecSchema = z.object({
  format: z.enum(['md', 'html']),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  blocks: z.array(block).min(1).max(40),
  fileName: z.string().trim().regex(/^[\p{L}\p{N} ._-]{1,80}$/u, 'use so letras, numeros, espaco, ponto, hifen e sublinhado').optional(),
});

/** Argumentos de `write_report`: o relatorio como dados e a pasta onde salvar. */
export const writeReportSchema = z.object({
  spec: reportSpecSchema,
  folder: z.string().trim().min(1).max(1000).describe('Pasta (caminho absoluto) onde salvar o arquivo.'),
});
export type WriteReportArgs = z.infer<typeof writeReportSchema>;
