import { z } from 'zod';
import { type Transaction } from '../../domain/transaction/transaction.entity.ts';
import { TransactionNotFoundError } from '../../domain/transaction/transaction.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { deleteTransactionInputSchema } from './delete.transaction.input.schema.ts';

/**
 * Caso de uso "excluir transacao" (spec 002, RF-20). Busca no escopo do usuario antes de
 * remover pra devolver `TransactionNotFoundError` (CA-14). Devolve a transacao removida.
 */
export class DeleteTransactionUseCase {
  private readonly transactions: TransactionRepository;

  public constructor(transactions: TransactionRepository) {
    this.transactions = transactions;
  }

  public async execute(rawInput: unknown): Promise<Transaction> {
    const parsed = deleteTransactionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir transacao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.transactions.findById(input.userId, input.id);
    if (!existing) {
      throw new TransactionNotFoundError();
    }

    await this.transactions.delete(input.userId, input.id);
    return existing;
  }
}
