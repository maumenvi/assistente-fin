import { type ToolPort } from '../../ports/tool/tool.port.ts';
import { type AgentState } from '../agent.state.ts';
import { type NodeContext } from '../node.context.ts';

/**
 * Ferramentas da execucao (spec 032/033): no intent `preference` so existem as de memoria (salvar,
 * esquecer, listar); em `write_request`, as de consulta mais `propose_changes`; nos demais, so as de consulta. Uma nao enxerga a outra, entao um pedido de
 * consulta nunca grava preferencia (FR-008) e um pedido de preferencia nunca consulta dados.
 */
export function toolPortFor(state: AgentState, ctx: NodeContext): ToolPort {
  if (state.intent === 'write_request' && ctx.planTools !== undefined) return ctx.planTools;
  return state.intent === 'preference' && ctx.memoryTools !== undefined ? ctx.memoryTools : ctx.tools;
}
