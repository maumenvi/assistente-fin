import { eraseAgentTool, type AnyAgentTool } from '../agent.tool.ts';
import { createToolRegistry, type ToolRegistry } from '../tool.registry.ts';
import { createFileTool } from './create.file.agent.tool.ts';
import { editFileTool } from './edit.file.agent.tool.ts';
import { type FileToolDeps } from './file.tool.deps.ts';
import { writeReportTool } from '../report/write.report.agent.tool.ts';
import { requestFolderAccessTool } from './request.folder.access.agent.tool.ts';
import { readFileTool } from './read.file.agent.tool.ts';
import { searchFilesTool } from './search.files.agent.tool.ts';

/** Ferramentas de arquivo e de relatorio (spec 040): somente desktop. */
export function buildFileTools(deps: FileToolDeps): AnyAgentTool[] {
  return [eraseAgentTool(searchFilesTool(deps)), eraseAgentTool(readFileTool(deps)), eraseAgentTool(createFileTool(deps)), eraseAgentTool(editFileTool(deps)), eraseAgentTool(writeReportTool(deps)), eraseAgentTool(requestFolderAccessTool())];
}

/** Registro PROPRIO das ferramentas de arquivo: os de consulta, memoria e planejamento recusam o efeito `file`. */
export function createFileToolRegistry(tools: readonly AnyAgentTool[]): ToolRegistry {
  return createToolRegistry(tools, ['read', 'file']);
}
