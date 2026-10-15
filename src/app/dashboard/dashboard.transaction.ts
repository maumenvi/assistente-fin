import { type TransactionType } from '../../domain/transaction/transaction.type.ts';

/**
 * Forma minima de um lancamento que os totais do Dashboard leem (spec 022: extraido do renderer
 * do desktop para o app compartilhar com o celular). Estrutural: o `TransactionDto` do desktop e
 * a view do celular satisfazem sem conversao.
 */
export interface DashboardTransaction {
  readonly date: string;
  readonly type: TransactionType;
  readonly amountCents: number;
  readonly accountId: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly isSystemCategory: boolean;
  readonly isSystemTransfer: boolean;
  readonly isSystemCardPayment: boolean;
  readonly transferGroupId: string | null;
  readonly cardPaymentGroupId: string | null;
  readonly fixedExpenseId: string | null;
}
