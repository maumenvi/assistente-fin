import { z } from 'zod';
import { decodeTextBytes } from '../../attachment/extract/decode.text.bytes.ts';
import { FILE_LIMITS } from '../../../../domain/agent/folder/file.limits.ts';
import { requiresEditConfirmation } from '../../../../domain/agent/folder/requires.edit.confirmation.ts';
import { type AgentTool } from '../agent.tool.ts';
import { buildToolError } from '../shared/build.tool.error.ts';
import { buildToolResult } from '../shared/build.tool.result.ts';
import { buildEditPreview } from './build.edit.preview.ts';
import { fileToolError } from './file.tool.error.ts';
import { type FileToolDeps } from './file.tool.deps.ts';
import { requireFileGate } from './require.file.gate.ts';

const inputSchema = z
  .object({
    path: z.string().trim().min(1).max(1000).describe('Caminho absoluto de um arquivo que já existe.'),
    edits: z
      .array(z.object({ find: z.string().min(1).max(20_000), replace: z.string().max(FILE_LIMITS.writeMaxChars) }))
      .min(1)
      .max(50)
      .optional()
      .describe('Trocas: cada "find" deve aparecer exatamente uma vez no arquivo.'),
    content: z.string().max(FILE_LIMITS.writeMaxChars).optional().describe('Novo conteúdo inteiro (use OU edits).'),
  })
  .refine((v) => (v.edits === undefined) !== (v.content === undefined), { message: 'informe edits OU content, nao os dois' });
type Args = z.infer<typeof inputSchema>;

export const EDIT_FILE_TOOL = 'edit_file';

/** Aplica as trocas em ordem; cada trecho precisa existir uma unica vez, senao devolve o motivo. */
function applyEdits(text: string, edits: readonly { find: string; replace: string }[]): { ok: true; text: string } | { ok: false; reason: string } {
  let current = text;
  for (const edit of edits) {
    const first = current.indexOf(edit.find);
    if (first === -1) return { ok: false, reason: 'um trecho a trocar nao foi encontrado no arquivo' };
    if (current.indexOf(edit.find, first + 1) !== -1) return { ok: false, reason: 'um trecho a trocar aparece mais de uma vez; inclua mais contexto' };
    current = current.slice(0, first) + edit.replace + current.slice(first + edit.find.length);
  }
  return { ok: true, text: current };
}

/**
 * `edit_file` (spec 040, FR-012): edita um arquivo existente. Pasta sob git: grava direto (o historico desfaz). Sem git: mostra a
 * previa no chat e so grava se a pessoa aprovar.
 */
export function editFileTool(deps: FileToolDeps): AgentTool<Args> {
  return {
    id: EDIT_FILE_TOOL,
    description:
      'Edita um arquivo que já existe, trocando trechos (edits) ou substituindo o conteúdo (content). Em pasta sem git a pessoa vê a prévia e aprova no chat; se negar, o arquivo fica intacto. Leia o arquivo antes de editar.',
    effect: 'file',
    input: inputSchema,
    async run(args, ctx) {
      try {
        const gate = requireFileGate(ctx);
        const real = await gate.ensure(args.path, 'edit');
        const bytes = await deps.files.read(real, FILE_LIMITS.readMaxBytes);
        if (bytes.subarray(0, 4096).includes(0)) return buildToolError(EDIT_FILE_TOOL, { code: 'invalid_args', message: 'o arquivo nao e de texto' });
        const before = decodeTextBytes(bytes);
        let after = args.content ?? before;
        if (args.edits !== undefined) {
          const applied = applyEdits(before, args.edits);
          if (!applied.ok) return buildToolError(EDIT_FILE_TOOL, { code: 'invalid_args', message: applied.reason });
          after = applied.text;
        }
        const name = real.slice(real.lastIndexOf('/') + 1);
        if (after === before) return buildToolResult({ tool: EDIT_FILE_TOOL, body: 'Nada mudou: o arquivo ja tem esse conteudo.', facts: [], summary: { tool: EDIT_FILE_TOOL, label: `sem mudanca em ${name}`, filters: {}, itemCount: 0, truncated: false } });
        if (requiresEditConfirmation(await deps.git.isInsideRepo(real)) && !(await gate.confirmEdit(real, buildEditPreview(before, after)))) {
          return buildToolError(EDIT_FILE_TOOL, { code: 'permission_denied', message: 'a pessoa nao aprovou a edicao; o arquivo continua como estava' });
        }
        await deps.files.write(real, after);
        return buildToolResult({
          tool: EDIT_FILE_TOOL,
          body: `Arquivo editado: ${real}`,
          facts: [],
          summary: { tool: EDIT_FILE_TOOL, label: `editei ${name}`, filters: { caminho: real }, itemCount: 1, truncated: false },
        });
      } catch (error) {
        return fileToolError(EDIT_FILE_TOOL, error);
      }
    },
  };
}
