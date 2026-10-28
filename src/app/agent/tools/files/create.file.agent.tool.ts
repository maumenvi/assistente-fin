import { z } from 'zod';
import { FILE_LIMITS } from '../../../../domain/agent/folder/file.limits.ts';
import { type AgentTool } from '../agent.tool.ts';
import { buildToolResult } from '../shared/build.tool.result.ts';
import { fileToolError } from './file.tool.error.ts';
import { type FileToolDeps } from './file.tool.deps.ts';
import { requireFileGate } from './require.file.gate.ts';

const inputSchema = z.object({
  path: z.string().trim().min(1).max(1000).describe('Caminho absoluto do arquivo a criar (a pasta precisa existir).'),
  content: z.string().max(FILE_LIMITS.writeMaxChars).describe('Conteúdo do arquivo.'),
});
type Args = z.infer<typeof inputSchema>;

export const CREATE_FILE_TOOL = 'create_file';

/** `create_file` (spec 040, FR-010): cria um arquivo novo; NUNCA sobrescreve (nome existente ganha sufixo -2, -3). */
export function createFileTool(deps: FileToolDeps): AgentTool<Args> {
  return {
    id: CREATE_FILE_TOOL,
    description:
      'Cria um arquivo novo numa pasta do computador da pessoa. Nunca sobrescreve: se o nome já existir, grava com sufixo -2, -3. Se a pasta não foi liberada para criar, o app pergunta no chat.',
    effect: 'file',
    input: inputSchema,
    async run(args, ctx) {
      try {
        const real = await requireFileGate(ctx).ensure(args.path, 'create');
        const written = await deps.files.create(real, args.content);
        const name = written.slice(written.lastIndexOf('/') + 1);
        return buildToolResult({
          tool: CREATE_FILE_TOOL,
          body: `Arquivo criado: ${written} (${args.content.length} caracteres)`,
          facts: [],
          summary: { tool: CREATE_FILE_TOOL, label: `criei ${name}`, filters: { caminho: written }, itemCount: 1, truncated: false },
        });
      } catch (error) {
        return fileToolError(CREATE_FILE_TOOL, error);
      }
    },
  };
}
