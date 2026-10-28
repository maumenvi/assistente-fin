/** As 14 operacoes que um plano pode conter (spec 033, data-model.md 3). */
export const OPERATION_KINDS = [
  'transaction.create',
  'transaction.update',
  'transaction.categorize',
  'transaction.delete',
  'category.create',
  'category.rename',
  'income.create',
  'income.update',
  'income.delete',
  'fixedExpense.create',
  'fixedExpense.update',
  'fixedExpense.delete',
  'transfer.create',
  'cardPayment.create',
] as const;

export type OperationKind = (typeof OPERATION_KINDS)[number];
