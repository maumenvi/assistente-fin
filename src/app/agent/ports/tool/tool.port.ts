import { type ToolSpec } from '../llm/tool.spec.ts';
import { type ToolContext } from './tool.context.ts';
import { type ToolInvocation } from './tool.invocation.ts';
import { type ToolResult } from './tool.result.ts';

/**
 * Conjunto de ferramentas que o agente pode chamar (spec 031). A spec 034 compoe ferramentas
 * externas (MCP) por tras da mesma porta.
 */
export interface ToolPort {
  /** Ferramentas visiveis ao modelo neste momento. */
  list(): readonly ToolSpec[];
  /** Nunca lanca: falhas voltam em `ToolResult.error`. */
  execute(call: ToolInvocation, ctx: ToolContext, signal?: AbortSignal): Promise<ToolResult>;
}
