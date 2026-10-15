import { type AgentEntity } from './agent.entity.ts';
import { type AgentOpKind } from './agent.op.kind.ts';

/** Quais operacoes cada entidade aceita na v1 (spec 029, R3). Fora disto o bloco e recusado. */
export const AGENT_OP_MATRIX: Readonly<Record<AgentEntity, readonly AgentOpKind[]>> = {
  transaction: ['create', 'update', 'delete'],
  income: ['create', 'update', 'delete'],
  fixedExpense: ['create', 'update', 'pay', 'delete'],
  spendingLimit: ['create', 'update', 'delete'],
  category: ['create'],
  installmentPurchase: ['create', 'delete', 'cancelRemaining'],
};
