import { z } from 'zod';
import { TransactionNotFoundError } from '../../domain/transaction/transaction.not.found.error.ts';
import { NotAnInstallmentError } from '../../domain/transaction/not.an.installment.error.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { deleteInstallmentGroupInputSchema } from './delete.installment.group.input.schema.ts';

/** Resultado de `DeleteInstallmentGroupUseCase`: quantas parcelas foram excluidas. */
export interface DeleteInstallmentGroupResult {
  readonly deletedCount: number;
}

/**
 * Caso de uso "excluir grupo de parcelas inteiro" — diferente de
 * `CancelRemainingInstallmentsUseCase` (que so remove as parcelas futuras ainda nao
 * vencidas), este exclui TODAS as parcelas do grupo, inclusive as ja vencidas/passadas.
 *
 * A partir de qualquer parcela do grupo (`transactionId`), busca a transacao no escopo do
 * usuario (`TransactionNotFoundError` se ausente/de outro usuario) e confirma que ela e
 * mesmo uma parcela (`installmentGroupId` nao nulo - `NotAnInstallmentError` caso
 * contrario). Busca todas as parcelas do grupo via `listByInstallmentGroup` e exclui em
 * loop chamando `transactions.delete` (mesma decisao ja tomada em
 * `CancelRemainingInstallmentsUseCase` - sem `deleteMany` no port).
 */
export class DeleteInstallmentGroupUseCase {
  private readonly transactions: TransactionRepository;

  public constructor(transactions: TransactionRepository) {
    this.transactions = transactions;
  }

  public async execute(rawInput: unknown): Promise<DeleteInstallmentGroupResult> {
    const parsed = deleteInstallmentGroupInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir grupo de parcelas', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const reference = await this.transactions.findById(input.userId, input.transactionId);
    if (!reference) {
      throw new TransactionNotFoundError();
    }
    if (reference.installmentGroupId === null) {
      throw new NotAnInstallmentError();
    }

    const installments = await this.transactions.listByInstallmentGroup(
      input.userId,
      reference.installmentGroupId,
    );

    for (const installment of installments) {
      await this.transactions.delete(input.userId, installment.id);
    }

    return { deletedCount: installments.length };
  }
}
