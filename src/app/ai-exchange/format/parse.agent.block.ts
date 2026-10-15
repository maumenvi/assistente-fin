import { AiBlockInvalidError } from '../errors/ai.block.invalid.error.ts';
import { agentBlockSchema } from './agent.block.schema.ts';
import { type AgentBlock } from './agent.block.ts';
import { toBlockIssues } from './to.block.issues.ts';

/**
 * Valida o objeto lido do bloco e o devolve tipado (spec 029, FR-004). Qualquer desvio vira
 * `AiBlockInvalidError` com um problema por operacao; nada e salvo nesta etapa (SC-003).
 */
export function parseAgentBlock(raw: unknown): AgentBlock {
  const parsed = agentBlockSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiBlockInvalidError(toBlockIssues(parsed.error));
  }
  return parsed.data;
}
