import { z } from 'zod';
import { type OperationKind } from '../../../../domain/plan/operation.kind.ts';
import { cardPaymentCreateOperation } from './card.payment.create.operation.ts';
import { categoryCreateOperation } from './category.create.operation.ts';
import { categoryRenameOperation } from './category.rename.operation.ts';
import { fixedExpenseCreateOperation } from './fixed.expense.create.operation.ts';
import { fixedExpenseDeleteOperation } from './fixed.expense.delete.operation.ts';
import { fixedExpenseUpdateOperation } from './fixed.expense.update.operation.ts';
import { incomeCreateOperation } from './income.create.operation.ts';
import { incomeDeleteOperation } from './income.delete.operation.ts';
import { incomeUpdateOperation } from './income.update.operation.ts';
import { type OperationAdapter } from './operation.adapter.ts';
import { transactionCategorizeOperation } from './transaction.categorize.operation.ts';
import { transactionCreateOperation } from './transaction.create.operation.ts';
import { transactionDeleteOperation } from './transaction.delete.operation.ts';
import { transactionUpdateOperation } from './transaction.update.operation.ts';
import { transferCreateOperation } from './transfer.create.operation.ts';

const ALL: readonly OperationAdapter[] = [
  transactionCreateOperation, transactionUpdateOperation, transactionCategorizeOperation, transactionDeleteOperation,
  categoryCreateOperation, categoryRenameOperation,
  incomeCreateOperation, incomeUpdateOperation, incomeDeleteOperation,
  fixedExpenseCreateOperation, fixedExpenseUpdateOperation, fixedExpenseDeleteOperation,
  transferCreateOperation, cardPaymentCreateOperation,
];

const BY_KIND = new Map<OperationKind, OperationAdapter>(ALL.map((a) => [a.kind, a]));

/** Adaptador da operacao, ou `undefined` para um `kind` desconhecido. */
export function operationOf(kind: string): OperationAdapter | undefined {
  return BY_KIND.get(kind as OperationKind);
}

export function allOperations(): readonly OperationAdapter[] {
  return ALL;
}

/** Uniao discriminada por `kind` mostrada ao modelo (argumentos de cada operacao + o `kind` e a confianca). */
export function operationUnionSchema(): z.ZodType<{ kind: OperationKind; confidence?: number | undefined } & Record<string, unknown>> {
  const members = ALL.map((a) => a.schema.extend({ kind: z.literal(a.kind), confidence: z.number().min(0).max(1).optional().describe('0 a 1: quanto voce tem certeza desta interpretacao') }));
  return z.discriminatedUnion('kind', members as unknown as [(typeof members)[number], ...(typeof members)[number][]]) as never;
}
