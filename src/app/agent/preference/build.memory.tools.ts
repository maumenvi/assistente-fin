import { eraseAgentTool, type AnyAgentTool } from '../tools/agent.tool.ts';
import { forgetPreferenceTool } from './tools/forget.preference.tool.ts';
import { listPreferencesTool } from './tools/list.preferences.tool.ts';
import { type MemoryToolDeps } from './tools/memory.tool.deps.ts';
import { rememberPreferenceTool } from './tools/remember.preference.tool.ts';

/** As 3 ferramentas de memoria (spec 032): salvar, esquecer e listar preferencias. `effect: 'memory'`. */
export function buildMemoryTools(deps: MemoryToolDeps): AnyAgentTool[] {
  return [eraseAgentTool(rememberPreferenceTool(deps)), eraseAgentTool(forgetPreferenceTool(deps)), eraseAgentTool(listPreferencesTool(deps))];
}
