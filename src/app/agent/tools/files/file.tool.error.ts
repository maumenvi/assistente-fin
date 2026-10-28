import { AgentError } from '../../../../domain/agent/errors/agent.error.ts';
import { FileTooLargeError } from '../../../../domain/agent/errors/file.too.large.error.ts';
import { FolderAccessDeniedError } from '../../../../domain/agent/errors/folder.access.denied.error.ts';
import { PathOutsideGrantError } from '../../../../domain/agent/errors/path.outside.grant.error.ts';
import { type ToolResult } from '../../ports/tool/tool.result.ts';
import { buildToolError } from '../shared/build.tool.error.ts';

/** Traduz a falha de uma ferramenta de arquivo em erro curto para o modelo (nunca expoe caminho de sistema nem pilha). */
export function fileToolError(tool: string, error: unknown): ToolResult {
  if (error instanceof FolderAccessDeniedError || error instanceof PathOutsideGrantError) return buildToolError(tool, { code: 'permission_denied', message: error.message });
  if (error instanceof FileTooLargeError) return buildToolError(tool, { code: 'too_large', message: error.message });
  if (error instanceof AgentError) return buildToolError(tool, { code: 'failed', message: error.message });
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') return buildToolError(tool, { code: 'not_found', message: 'arquivo ou pasta nao encontrado' });
  if (code === 'EACCES' || code === 'EPERM') return buildToolError(tool, { code: 'permission_denied', message: 'o sistema nao permitiu acessar este caminho' });
  return buildToolError(tool, { code: 'failed', message: 'a operacao no arquivo falhou' });
}
