import { eraseAgentTool, type AnyAgentTool } from './agent.tool.ts';
import { calculateTool } from './calculate.agent.tool.ts';
import { comparePeriodsTool } from './compare.periods.agent.tool.ts';
import { getAccountBalancesTool } from './get.account.balances.agent.tool.ts';
import { getCreditCardStatusTool } from './get.credit.card.status.agent.tool.ts';
import { getForecastTool } from './get.forecast.agent.tool.ts';
import { getMonthSummaryTool } from './get.month.summary.agent.tool.ts';
import { getSpendingLimitsTool } from './get.spending.limits.agent.tool.ts';
import { listCategoriesTool } from './list.categories.agent.tool.ts';
import { listFixedExpensesTool } from './list.fixed.expenses.agent.tool.ts';
import { listIncomesTool } from './list.incomes.agent.tool.ts';
import { listUncategorizedTransactionsTool } from './list.uncategorized.agent.tool.ts';
import { queryTransactionsTool } from './query.transactions.agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';

/** As ferramentas de consulta e calculo do agente (specs 031 e 037). Todas somente leitura. */
export function buildDefaultAgentTools(deps: AgentToolDeps): AnyAgentTool[] {
  return [
    eraseAgentTool(getAccountBalancesTool(deps)),
    eraseAgentTool(queryTransactionsTool(deps)),
    eraseAgentTool(getCreditCardStatusTool(deps)),
    eraseAgentTool(getSpendingLimitsTool(deps)),
    eraseAgentTool(getForecastTool(deps)),
    eraseAgentTool(listCategoriesTool(deps)),
    eraseAgentTool(listIncomesTool(deps)),
    eraseAgentTool(listFixedExpensesTool(deps)),
    eraseAgentTool(getMonthSummaryTool(deps)),
    eraseAgentTool(calculateTool()),
    eraseAgentTool(comparePeriodsTool(deps)),
    eraseAgentTool(listUncategorizedTransactionsTool(deps)),
  ];
}
