/** Tipos de operacao do bloco (spec 029, contracts/agent.block.format.md). */
export const AGENT_OP_KINDS = ['create', 'update', 'pay', 'delete', 'cancelRemaining'] as const;

export type AgentOpKind = (typeof AGENT_OP_KINDS)[number];
