import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { CardPaymentNotFoundError } from '../../domain/transaction/card.payment.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { updateCardPaymentInputSchema } from './update.card.payment.input.schema.ts';

/** As duas pontas de um pagamento de fatura apos a atualizacao. */
export interface UpdateCardPaymentResult {
  readonly outgoing: Transaction;
  readonly incoming: Transaction;
}

/**
 * Caso de uso "atualizar pagamento de fatura" (spec 016, decisao do usuario) - mesmo padrao
 * de `UpdateTransferUseCase`: so metadados compartilhados (`date`, `notes`), sempre
 * replicados as duas pernas juntas dentro de `database.transaction()`. Nunca aceita
 * `amountCents`/contas (nao existem no schema de entrada).
 */
export class UpdateCardPaymentUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<UpdateCardPaymentResult> {
    const parsed = updateCardPaymentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar pagamento de fatura', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const reference = await this.database.transactions.findById(input.userId, input.transactionId);
    if (!reference || reference.cardPaymentGroupId === null) {
      throw new CardPaymentNotFoundError();
    }

    const legs = await this.database.transactions.listByCardPaymentGroup(
      input.userId,
      reference.cardPaymentGroupId,
    );
    const outgoingLeg = legs.find((leg) => leg.type === 'expense');
    const incomingLeg = legs.find((leg) => leg.type === 'income');
    if (!outgoingLeg || !incomingLeg) {
      throw new CardPaymentNotFoundError();
    }

    const applyUpdate = (leg: Transaction): Transaction =>
      Transaction.create({
        id: leg.id,
        userId: leg.userId,
        date: input.date !== undefined ? new Date(input.date) : leg.date,
        amount: leg.amount,
        type: leg.type,
        categoryId: leg.categoryId,
        accountId: leg.accountId,
        notes: input.notes !== undefined ? input.notes : leg.notes,
        cardPaymentGroupId: leg.cardPaymentGroupId,
      }).withUpdatedAt(leg.updatedAt);

    return this.database.transaction(async (tx) => {
      const outgoing = applyUpdate(outgoingLeg);
      const incoming = applyUpdate(incomingLeg);
      await tx.transactions.save(outgoing);
      await tx.transactions.save(incoming);
      return { outgoing, incoming };
    });
  }
}
