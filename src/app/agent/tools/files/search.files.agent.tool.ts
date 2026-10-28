import { z } from 'zod';
import { FILE_LIMITS } from '../../../../domain/agent/folder/file.limits.ts';
import { buildToolError } from '../shared/build.tool.error.ts';
import { countFact } from '../shared/count.fact.ts';
import { type AgentTool } from '../agent.tool.ts';
import { fileToolError } from './file.tool.error.ts';
import { type FileToolDeps } from './file.tool.deps.ts';
import { fileToolResult } from './file.tool.result.ts';
import { requireFileGate } from './require.file.gate.ts';

const inputSchema = z.object({
  root: z.string().trim().min(1).max(1000).describe('Pasta onde procurar (caminho absoluto, ex.: /home/ana/Documentos).'),
  query: z.string().trim().min(1).max(200).optional().describe('Trecho do nome do arquivo.'),
  glob: z.string().trim().min(1).max(200).optional().describe('Padrão do nome com * e ?, ex.: *.csv.'),
  maxResults: z.int().min(1).max(FILE_LIMITS.searchMaxResults).optional().describe(`Máximo de resultados (até ${FILE_LIMITS.searchMaxResults}); padrão 50.`),
});
type Args = z.infer<typeof inputSchema>;

export const SEARCH_FILES_TOOL = 'search_files';

/** `search_files` (spec 040, FR-009): procura arquivos por nome numa pasta que a pessoa autorizou (pergunta no chat se faltar). */
export function searchFilesTool(deps: FileToolDeps): AgentTool<Args> {
  return {
    id: SEARCH_FILES_TOOL,
    description:
      'Procura arquivos pelo nome dentro de uma pasta do computador da pessoa (e subpastas). Use para achar extratos, planilhas ou documentos. Se a pasta ainda não foi liberada, o app pergunta à pessoa no chat; se ela negar, avise que não tem acesso. Devolve caminho, tamanho e data de cada arquivo.',
    effect: 'file',
    input: inputSchema,
    async run(args, ctx) {
      try {
        const root = await requireFileGate(ctx).ensure(args.root, 'read');
        if (!(await deps.files.isDirectory(root))) return buildToolError(SEARCH_FILES_TOOL, { code: 'not_found', message: 'pasta nao encontrada: chame request_folder_access para a pessoa escolher a pasta' });
        const max = args.maxResults ?? 50;
        const found = await deps.files.search(root, { query: args.query, glob: args.glob, maxResults: max });
        const lines = found.entries.map((e) => `${e.path} · ${e.size} bytes · ${e.modifiedAt.slice(0, 10)}`);
        const body = found.entries.length === 0 ? 'Nenhum arquivo encontrado.' : `${lines.join('\n')}${found.truncated ? `\n[mais resultados existem: refine a busca]` : ''}`;
        return fileToolResult({
          tool: SEARCH_FILES_TOOL,
          label: `arquivos em ${root}`,
          body,
          facts: [countFact(`file:search:${root}:${args.query ?? ''}:${args.glob ?? ''}`, `arquivos encontrados em ${root}`, found.entries.length)],
          itemCount: found.entries.length,
          truncated: found.truncated,
          filters: { ...(args.query === undefined ? {} : { nome: args.query }), ...(args.glob === undefined ? {} : { padrao: args.glob }) },
        });
      } catch (error) {
        return fileToolError(SEARCH_FILES_TOOL, error);
      }
    },
  };
}
