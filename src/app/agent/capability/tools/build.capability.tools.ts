import { eraseAgentTool, type AnyAgentTool } from '../../tools/agent.tool.ts';
import { type CapabilityToolDeps } from './capability.tool.deps.ts';
import { callCapabilityTool } from './call.capability.tool.ts';
import { findCapabilityTool } from './find.capability.tool.ts';
import { listCapabilityToolsTool } from './list.capability.tools.tool.ts';
import { readSkillTool } from './read.skill.tool.ts';

/** As 4 meta-ferramentas de capacidade (spec 034, FR-005): procurar, listar, chamar e ler skill. `effect: 'external'`. */
export function buildCapabilityTools(deps: CapabilityToolDeps): AnyAgentTool[] {
  return [eraseAgentTool(findCapabilityTool(deps)), eraseAgentTool(listCapabilityToolsTool(deps)), eraseAgentTool(callCapabilityTool(deps)), eraseAgentTool(readSkillTool(deps))];
}
