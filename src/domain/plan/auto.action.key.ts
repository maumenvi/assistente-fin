import { type OperationKind } from './operation.kind.ts';

/** Acoes que a politica de autonomia pode liberar (spec 033, FR-018). */
export const AUTO_ACTION_KEYS = [
  'transaction.create',
  'transaction.update',
  'transaction.categorize',
  'income.create',
  'income.update',
  'fixedExpense.create',
  'fixedExpense.update',
  'category.create',
  'category.rename',
] as const;

export type AutoActionKey = (typeof AUTO_ACTION_KEYS)[number];

/**
 * Chave de autonomia da operacao, ou `null` quando ela exige aprovacao sempre: todo `*.delete`,
 * transferencia e pagamento de fatura nao tem chave (FR-020).
 */
export function autoKeyOf(kind: OperationKind): AutoActionKey | null {
  return (AUTO_ACTION_KEYS as readonly string[]).includes(kind) ? (kind as AutoActionKey) : null;
}
