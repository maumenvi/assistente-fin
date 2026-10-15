import { type AgentEntity } from '../format/agent.entity.ts';
import { type AgentOpKind } from '../format/agent.op.kind.ts';
import { type OperationHandler } from './operation.handler.ts';
import { createTransactionHandler } from './operation.handlers/create.transaction.handler.ts';
import { updateTransactionHandler } from './operation.handlers/update.transaction.handler.ts';
import { deleteTransactionHandler } from './operation.handlers/delete.transaction.handler.ts';
import { createIncomeHandler } from './operation.handlers/create.income.handler.ts';
import { updateIncomeHandler } from './operation.handlers/update.income.handler.ts';
import { deleteIncomeHandler } from './operation.handlers/delete.income.handler.ts';
import { createFixedExpenseHandler } from './operation.handlers/create.fixed.expense.handler.ts';
import { updateFixedExpenseHandler } from './operation.handlers/update.fixed.expense.handler.ts';
import { payFixedExpenseHandler } from './operation.handlers/pay.fixed.expense.handler.ts';
import { deleteFixedExpenseHandler } from './operation.handlers/delete.fixed.expense.handler.ts';
import { createSpendingLimitHandler } from './operation.handlers/create.spending.limit.handler.ts';
import { updateSpendingLimitHandler } from './operation.handlers/update.spending.limit.handler.ts';
import { deleteSpendingLimitHandler } from './operation.handlers/delete.spending.limit.handler.ts';
import { createCategoryHandler } from './operation.handlers/create.category.handler.ts';
import { createInstallmentPurchaseHandler } from './operation.handlers/create.installment.purchase.handler.ts';
import { deleteInstallmentGroupHandler } from './operation.handlers/delete.installment.group.handler.ts';
import { cancelRemainingInstallmentsHandler } from './operation.handlers/cancel.remaining.installments.handler.ts';

const HANDLERS: readonly OperationHandler[] = [
  createTransactionHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
  createIncomeHandler,
  updateIncomeHandler,
  deleteIncomeHandler,
  createFixedExpenseHandler,
  updateFixedExpenseHandler,
  payFixedExpenseHandler,
  deleteFixedExpenseHandler,
  createSpendingLimitHandler,
  updateSpendingLimitHandler,
  deleteSpendingLimitHandler,
  createCategoryHandler,
  createInstallmentPurchaseHandler,
  deleteInstallmentGroupHandler,
  cancelRemainingInstallmentsHandler,
];

const BY_KEY = new Map(HANDLERS.map((handler) => [`${handler.entity}:${handler.kind}`, handler]));

/** Handler da combinacao (entidade, operacao), ou `null` se a v1 nao a suporta (spec 029, R3). */
export function findOperationHandler(entity: AgentEntity, kind: AgentOpKind): OperationHandler | null {
  return BY_KEY.get(`${entity}:${kind}`) ?? null;
}

/** Todos os handlers registrados (para os testes de cobertura da matriz). */
export function listOperationHandlers(): readonly OperationHandler[] {
  return HANDLERS;
}
