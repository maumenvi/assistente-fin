import { ReportDataMismatchError } from '../../../../domain/agent/errors/report.data.mismatch.error.ts';
import { type ReportSpec } from '../../../../domain/agent/report/report.spec.ts';
import { type AgentTool } from '../agent.tool.ts';
import { buildToolError } from '../shared/build.tool.error.ts';
import { buildToolResult } from '../shared/build.tool.result.ts';
import { fileToolError } from '../files/file.tool.error.ts';
import { type FileToolDeps } from '../files/file.tool.deps.ts';
import { requireFileGate } from '../files/require.file.gate.ts';
import { renderReportHtml } from './render.report.html.ts';
import { renderReportMarkdown } from './render.report.markdown.ts';
import { reportFileName } from './report.file.name.ts';
import { type WriteReportArgs, writeReportSchema } from './report.input.schema.ts';
import { validateReportFigures } from './validate.report.figures.ts';

export const WRITE_REPORT_TOOL = 'write_report';

/**
 * `write_report` (spec 040, FR-014..017): recebe o relatorio como DADOS, confere que todo numero veio das consultas da execucao,
 * renderiza `.md`/`.html` de forma deterministica e grava numa pasta autorizada (acesso `create`; pergunta no chat se faltar).
 * Nunca sobrescreve: nome existente ganha sufixo.
 */
export function writeReportTool(deps: FileToolDeps): AgentTool<WriteReportArgs> {
  return {
    id: WRITE_REPORT_TOOL,
    description:
      'Gera um relatório (.md ou .html com tabelas e gráficos) a partir de dados que você JÁ consultou e salva numa pasta do computador. Todo número do relatório precisa vir das consultas desta conversa (o app confere e recusa o resto). Informe format, title, summary e blocks (text, table, chart) e a pasta. Devolve o caminho do arquivo.',
    effect: 'file',
    input: writeReportSchema,
    async run(args, ctx) {
      try {
        const spec: ReportSpec = args.spec;
        try {
          validateReportFigures(spec, ctx.turn?.ledger ?? [], ctx.turn?.userText ?? '');
        } catch (error) {
          if (error instanceof ReportDataMismatchError) {
            return buildToolError(WRITE_REPORT_TOOL, { code: 'invalid_args', message: `${error.message}. Consulte os dados com as ferramentas e use os valores exatos.`.slice(0, 240) });
          }
          throw error;
        }
        const folder = await requireFileGate(ctx).ensure(args.folder, 'create');
        if (!(await deps.files.isDirectory(folder))) return buildToolError(WRITE_REPORT_TOOL, { code: 'not_found', message: 'a pasta nao existe' });
        const content = spec.format === 'html' ? renderReportHtml(spec, ctx.now) : renderReportMarkdown(spec, ctx.now);
        const path = await deps.files.create(`${folder}/${reportFileName(spec)}`, content);
        const name = path.slice(path.lastIndexOf('/') + 1);
        return {
          ...buildToolResult({
            tool: WRITE_REPORT_TOOL,
            body: `Relatório salvo em ${path}`,
            facts: [],
            summary: { tool: WRITE_REPORT_TOOL, label: `relatório ${name}`, filters: { formato: spec.format }, itemCount: spec.blocks.length, truncated: false },
          }),
          report: { path, format: spec.format },
        };
      } catch (error) {
        return fileToolError(WRITE_REPORT_TOOL, error);
      }
    },
  };
}
