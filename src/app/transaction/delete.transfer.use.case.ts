import { z } from 'zod';
import { TransferNotFoundError } from '../../domain/transaction/transfer.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { deleteTransferInputSchema } from './delete.transfer.input.schema.ts';

/** Resultado de `DeleteTransferUseCase`: sempre 2 (as duas pontas), nunca uma orfa. */
export interface DeleteTransferResult {
  readonly deletedCount: number;
}

/**
 * Caso de uso "excluir transferencia inteira" (spec 016, RF-5) - mesmo padrao de
 * `DeleteInstallmentGroupUseCase`: a partir de QUALQUER uma das duas pontas
 * (`transactionId`), busca a transacao no escopo do usuario (`TransferNotFoundError` se
 * ausente/de outro usuario ou se `transferGroupId` for nulo - nao e uma transferencia),
 * lista o grupo completo (`listByTransferGroup`) e exclui as duas dentro de
 * `database.transaction()` (criterio de aceite 2/5): ou as duas saem, ou nenhuma sai - uma
 * falha no meio do loop nunca deixa uma perna orfa persistida.
 */
export class DeleteTransferUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<DeleteTransferResult> {
    const parsed = deleteTransferInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir transferencia', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const reference = await this.database.transactions.findById(input.userId, input.transactionId);
    if (!reference || reference.transferGroupId === null) {
      throw new TransferNotFoundError();
    }

    const groupId = reference.transferGroupId;
    return this.database.transaction(async (tx) => {
      const legs = await tx.transactions.listByTransferGroup(input.userId, groupId);
      for (const leg of legs) {
        await tx.transactions.delete(input.userId, leg.id);
      }
      return { deletedCount: legs.length };
    });
  }
}
