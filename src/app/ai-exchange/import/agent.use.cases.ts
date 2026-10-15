import { type RecordTransactionUseCase } from '../../transaction/record.transaction.use.case.ts';
import { type UpdateTransactionUseCase } from '../../transaction/update.transaction.use.case.ts';
import { type DeleteTransactionUseCase } from '../../transaction/delete.transaction.use.case.ts';
import { type RecordInstallmentPurchaseUseCase } from '../../transaction/record.installment.purchase.use.case.ts';
import { type DeleteInstallmentGroupUseCase } from '../../transaction/delete.installment.group.use.case.ts';
import { type CancelRemainingInstallmentsUseCase } from '../../transaction/cancel.remaining.installments.use.case.ts';
import { type RegisterIncomeUseCase } from '../../income/register.income.use.case.ts';
import { type UpdateIncomeUseCase } from '../../income/update.income.use.case.ts';
import { type DeleteIncomeUseCase } from '../../income/delete.income.use.case.ts';
import { type RegisterFixedExpenseUseCase } from '../../fixed-expense/register.fixed.expense.use.case.ts';
import { type UpdateFixedExpenseUseCase } from '../../fixed-expense/update.fixed.expense.use.case.ts';
import { type DeleteFixedExpenseUseCase } from '../../fixed-expense/delete.fixed.expense.use.case.ts';
import { type SetFixedExpensePaidUseCase } from '../../fixed-expense/set.fixed.expense.paid.use.case.ts';
import { type SetSpendingLimitUseCase } from '../../spending-limit/set.spending.limit.use.case.ts';
import { type UpdateSpendingLimitUseCase } from '../../spending-limit/update.spending.limit.use.case.ts';
import { type DeleteSpendingLimitUseCase } from '../../spending-limit/delete.spending.limit.use.case.ts';
import { type CreateCategoryUseCase } from '../../category/create.category.use.case.ts';

/**
 * Os casos de uso que o importador chama (spec 029, R3). O `Container` do app os satisfaz; quem
 * monta a fabrica (`AgentUseCasesFactory`) e a raiz de composicao, para a camada de aplicacao nao
 * depender de `composition/`.
 */
export interface AgentUseCases {
  readonly recordTransaction: RecordTransactionUseCase;
  readonly updateTransaction: UpdateTransactionUseCase;
  readonly deleteTransaction: DeleteTransactionUseCase;
  readonly recordInstallmentPurchase: RecordInstallmentPurchaseUseCase;
  readonly deleteInstallmentGroup: DeleteInstallmentGroupUseCase;
  readonly cancelRemainingInstallments: CancelRemainingInstallmentsUseCase;
  readonly registerIncome: RegisterIncomeUseCase;
  readonly updateIncome: UpdateIncomeUseCase;
  readonly deleteIncome: DeleteIncomeUseCase;
  readonly registerFixedExpense: RegisterFixedExpenseUseCase;
  readonly updateFixedExpense: UpdateFixedExpenseUseCase;
  readonly deleteFixedExpense: DeleteFixedExpenseUseCase;
  readonly setFixedExpensePaid: SetFixedExpensePaidUseCase;
  readonly setSpendingLimit: SetSpendingLimitUseCase;
  readonly updateSpendingLimit: UpdateSpendingLimitUseCase;
  readonly deleteSpendingLimit: DeleteSpendingLimitUseCase;
  readonly createCategory: CreateCategoryUseCase;
}
