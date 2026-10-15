import { z } from 'zod';
import { CardPaymentNotFoundError } from '../../domain/transaction/card.payment.not.found.error.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { deleteCardPaymentInputSchema } from './delete.card.payment.input.schema.ts';

/** Resultado de `DeleteCardPaymentUseCase`: sempre 2 (as duas pontas), nunca uma orfa. */
export interface DeleteCardPaymentResult {
  readonly deletedCount: number;
}

/**
 * Caso de uso "excluir pagamento de fatura inteiro" (spec 016, RF-6) - mesmo padrao de
 * `DeleteTransferUseCase`/`DeleteInstallmentGroupUseCase`: a partir de QUALQUER uma das duas
 * pontas (`transactionId`), busca a transacao no escopo do usuario
 * (`CardPaymentNotFoundError` se ausente/de outro usuario ou se `cardPaymentGroupId` for
 * nulo), lista o grupo completo (`listByCardPaymentGroup`) e exclui as duas em loop.
 */
export class DeleteCardPaymentUseCase {
  private readonly transactions: TransactionRepository;

  public constructor(transactions: TransactionRepository) {
    this.transactions = transactions;
  }

  public async execute(rawInput: unknown): Promise<DeleteCardPaymentResult> {
    const parsed = deleteCardPaymentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir pagamento de fatura', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const reference = await this.transactions.findById(input.userId, input.transactionId);
    if (!reference || reference.cardPaymentGroupId === null) {
      throw new CardPaymentNotFoundError();
    }

    const legs = await this.transactions.listByCardPaymentGroup(
      input.userId,
      reference.cardPaymentGroupId,
    );

    for (const leg of legs) {
      await this.transactions.delete(input.userId, leg.id);
    }

    return { deletedCount: legs.length };
  }
}
