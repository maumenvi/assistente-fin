import { type AgentPrompts } from './agent.prompts.ts';
import { CANNED_REPLIES } from './canned.replies.ts';
import { compactionSystemPrompt } from './compaction.prompt.ts';
import { preferenceModePrompt } from './preference.prompt.ts';
import { ROUTER_SCHEMA, routerSystemPrompt } from './router.prompt.ts';
import { buildSystemPrompt } from './system.prompt.ts';
import { writeModePrompt } from './write.prompt.ts';

/** Prompts padrao do agente (a avaliacao de regressao injeta uma versao degradada para comparar). */
export const DEFAULT_AGENT_PROMPTS: AgentPrompts = {
  system: buildSystemPrompt,
  compactionSystem: compactionSystemPrompt,
  preferenceMode: preferenceModePrompt,
  writeMode: writeModePrompt,
  routerSystem: routerSystemPrompt,
  routerSchema: ROUTER_SCHEMA,
  canned: CANNED_REPLIES,
};
