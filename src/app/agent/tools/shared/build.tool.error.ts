import { type ToolError } from '../../ports/tool/tool.error.ts';
import { type ToolResult } from '../../ports/tool/tool.result.ts';

/** Resultado de falha de uma ferramenta: texto curto para o modelo tentar de novo ou desistir. */
export function buildToolError(tool: string, error: ToolError): ToolResult {
  return {
    ok: false,
    contentForModel: `<dados origem="${tool}">\nerro (${error.code}): ${error.message}\n</dados>`,
    facts: [],
    summary: { tool, label: `${tool}: ${error.message}`, filters: {}, itemCount: 0, truncated: false },
    error,
  };
}
