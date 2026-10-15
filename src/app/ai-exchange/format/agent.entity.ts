/** Entidades que o agente pode criar ou alterar pelo bloco (spec 029, R3). */
export const AGENT_ENTITIES = [
  'transaction',
  'income',
  'fixedExpense',
  'spendingLimit',
  'category',
  'installmentPurchase',
] as const;

export type AgentEntity = (typeof AGENT_ENTITIES)[number];
