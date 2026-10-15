/** Limites do bloco (spec 029, contracts/agent.block.format.md). */
export const AGENT_BLOCK_LIMITS = {
  maxOps: 500,
  maxRefLength: 32,
  maxStringLength: 200,
  batchIdMin: 8,
  batchIdMax: 64,
} as const;
