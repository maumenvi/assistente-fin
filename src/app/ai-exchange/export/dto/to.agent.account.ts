import { type Account } from '../../../../domain/account/account.entity.ts';
import { type AgentAccountItem } from '../../format/agent.payload.ts';

/** Conta no formato do agente (spec 029, contracts/agent.payload.format.md). */
export function toAgentAccount(account: Account): AgentAccountItem {
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    archived: account.archived,
    ...(account.creditLimit !== null ? { creditLimitCents: account.creditLimit.cents } : {}),
    ...(account.closingDay !== null ? { closingDay: account.closingDay } : {}),
    ...(account.dueDay !== null ? { dueDay: account.dueDay } : {}),
  };
}
