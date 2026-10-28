import { type ToolResult } from '../../ports/tool/tool.result.ts';
import { buildToolResult } from '../../tools/shared/build.tool.result.ts';

/**
 * Resultado de uma ferramenta de memoria (spec 032): texto para o modelo dentro de `<dados>`, sem
 * fatos e `hidden` (nao vira cartao "Consultei" - preferencia nao e consulta aos dados).
 */
export function buildMemoryResult(tool: string, body: string, itemCount: number, maxChars: number): ToolResult {
  return {
    ...buildToolResult({ tool, body, facts: [], summary: { tool, label: 'preferências', filters: {}, itemCount, truncated: false }, maxChars }),
    hidden: true,
  };
}
