import { type ZodType } from 'zod';
import { type ToolContext } from '../ports/tool/tool.context.ts';
import { type ToolResult } from '../ports/tool/tool.result.ts';

/**
 * Definicao de uma ferramenta do agente (spec 031, contracts/tool.port.md). O `input` e o schema
 * Zod da FRONTEIRA (valida o que o modelo mandou) e NUNCA tem `userId`: o usuario vem do contexto.
 * `effect: 'write'` fica reservado a spec 033; o registro recusa hoje. `effect: 'memory'` (spec 032)
 * consulta ou grava so preferencias do usuario, nunca dados financeiros, e so existe no registro
 * proprio do intent `preference`. `effect: 'external'` (spec 034) sai do app para uma capacidade aprovada
 * (MCP remoto ou skill) e so existe nos registros de consulta e de planejamento. `effect: 'file'` (spec 040) le ou grava
 * arquivos do computador, depende de pasta autorizada pela pessoa e so existe no registro proprio e desktop-only de arquivos.
 */
export interface AgentTool<Args> {
  /** snake_case estavel (entra no trace e no log). */
  readonly id: string;
  /** pt-BR, escrita como prompt: diz ao modelo QUANDO usar. */
  readonly description: string;
  readonly effect: 'read' | 'write' | 'memory' | 'external' | 'file';
  readonly input: ZodType<Args>;
  run(args: Args, ctx: ToolContext, signal?: AbortSignal): Promise<ToolResult>;
}

/** Ferramenta com o tipo dos argumentos apagado, para caber em listas heterogeneas. */
export type AnyAgentTool = AgentTool<never>;

/** Apaga o tipo dos argumentos (o registro sempre valida `args` com `input` antes de chamar `run`). */
export function eraseAgentTool<Args>(tool: AgentTool<Args>): AnyAgentTool {
  return tool as unknown as AnyAgentTool;
}
