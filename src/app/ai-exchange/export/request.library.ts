import { type AgentRequest } from './agent.request.ts';
import { categorizeStatementRequest } from './requests/categorize.statement.request.ts';
import { logExpensesRequest } from './requests/log.expenses.request.ts';
import { monthlyReviewRequest } from './requests/monthly.review.request.ts';
import { planPurchaseRequest } from './requests/plan.purchase.request.ts';

/**
 * Biblioteca de pedidos prontos (spec 029, FR-017). Reaproveita as INTENCOES dos prompts do MCP do
 * desktop (revisao do mes, categorizar, planejar compra, lancar gastos); o texto e novo porque os
 * prompts do MCP mandam chamar ferramentas do servidor, que um chat de IA nao tem.
 */
export const REQUEST_LIBRARY: readonly AgentRequest[] = [monthlyReviewRequest, categorizeStatementRequest, planPurchaseRequest, logExpensesRequest];

/** Pedido pelo id, ou `null` (nenhum pedido: so as instrucoes). */
export function findRequest(id: string | null): AgentRequest | null {
  return REQUEST_LIBRARY.find((request) => request.id === id) ?? null;
}
