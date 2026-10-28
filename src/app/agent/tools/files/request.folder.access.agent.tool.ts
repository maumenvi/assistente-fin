import { z } from 'zod';
import { type AgentTool } from '../agent.tool.ts';
import { buildToolResult } from '../shared/build.tool.result.ts';
import { fileToolError } from './file.tool.error.ts';
import { requireFileGate } from './require.file.gate.ts';

const inputSchema = z.object({
  access: z.enum(['read', 'write']).describe('read = só ler arquivos; write = ler, criar e editar (use para salvar relatórios).'),
});
type Args = z.infer<typeof inputSchema>;

export const REQUEST_FOLDER_ACCESS_TOOL = 'request_folder_access';

/**
 * `request_folder_access` (spec 040): mostra no chat o cartao para a pessoa ESCOLHER uma pasta no seletor do sistema e a libera.
 * Use quando a pessoa pedir para liberar/configurar acesso a pastas ou quando voce precisar de uma pasta que nao conhece.
 */
export function requestFolderAccessTool(): AgentTool<Args> {
  return {
    id: REQUEST_FOLDER_ACCESS_TOOL,
    description:
      'Mostra à pessoa, no chat, um botão para escolher uma pasta do computador e liberar o acesso. Use quando ela pedir para liberar ou configurar acesso a pastas, ou quando precisar de uma pasta que você não conhece o caminho. Devolve o caminho liberado.',
    effect: 'file',
    input: inputSchema,
    async run(args, ctx) {
      try {
        const path = await requireFileGate(ctx).requestFolder(args.access === 'read' ? 'read' : 'edit');
        return buildToolResult({
          tool: REQUEST_FOLDER_ACCESS_TOOL,
          body: `Pasta liberada pela pessoa: ${path}. Use este caminho nas próximas buscas.`,
          facts: [],
          summary: { tool: REQUEST_FOLDER_ACCESS_TOOL, label: 'pasta liberada', filters: {}, itemCount: 1, truncated: false },
        });
      } catch (error) {
        return fileToolError(REQUEST_FOLDER_ACCESS_TOOL, error);
      }
    },
  };
}
