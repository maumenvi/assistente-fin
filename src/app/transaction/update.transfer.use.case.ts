import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { TransferNotFoundError } from '../../domain/transaction/transfer.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { updateTransferInputSchema } from './update.transfer.input.schema.ts';

/** As duas pontas de uma transferencia apos a atualizacao. */
export interface UpdateTransferResult {
  readonly outgoing: Transaction;
  readonly incoming: Transaction;
}

/**
 * Caso de uso "atualizar transferencia" (spec 016, decisao do usuario) - so metadados
 * compartilhados (`date`, `notes`), sempre replicados as duas pernas juntas dentro de
 * `database.transaction()`. Campo ausente na entrada mantem o valor atual daquela perna
 * (mesma semantica de `UpdateTransactionUseCase`).
 *
 * A partir de QUALQUER uma das duas pontas (`transactionId`), busca a transacao no escopo do
 * usuario (`TransferNotFoundError` se ausente/de outro usuario ou se `transferGroupId` for
 * nulo) e localiza a outra perna via `listByTransferGroup`.
 *
 * Nunca aceita `amountCents`/contas (nao existem no schema de entrada) - mudar valor ou
 * contas exige excluir e recriar atomicamente (`DeleteTransferUseCase` +
 * `CreateTransferUseCase`), nunca um update parcial que deixaria as pernas divergentes.
 */
export class UpdateTransferUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<UpdateTransferResult> {
    const parsed = updateTransferInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar transferencia', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const reference = await this.database.transactions.findById(input.userId, input.transactionId);
    if (!reference || reference.transferGroupId === null) {
      throw new TransferNotFoundError();
    }

    const legs = await this.database.transactions.listByTransferGroup(
      input.userId,
      reference.transferGroupId,
    );
    const outgoingLeg = legs.find((leg) => leg.type === 'expense');
    const incomingLeg = legs.find((leg) => leg.type === 'income');
    if (!outgoingLeg || !incomingLeg) {
      throw new TransferNotFoundError();
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
        transferGroupId: leg.transferGroupId,
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
