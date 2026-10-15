import { z } from 'zod';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { deleteManyTransactionsInputSchema } from './delete.many.transactions.input.schema.ts';

/** Resultado de `DeleteManyTransactionsUseCase`. */
export interface DeleteManyTransactionsResult {
  readonly deletedCount: number;
  readonly deletedIds: readonly string[];
}

/**
 * Caso de uso "excluir varias transacoes de uma vez" (selecao em lote no Extrato). Mesma
 * decisao ja tomada em `CancelRemainingInstallmentsUseCase`/`DeleteInstallmentGroupUseCase`
 * (sem `deleteMany` no port) - itera chamando `delete` por id. Nao ha logica de
 * grupo/serie: exclui exatamente os ids informados, sem arrastar parcelas ou ocorrencias
 * relacionadas que nao tenham sido explicitamente selecionadas.
 *
 * Ids inexistentes ou de outro usuario sao ignorados silenciosamente (mesmo espirito de
 * `TransactionRepository.delete`, que ja e silencioso nesse caso) - nao ha erro parcial,
 * so `deletedCount` reflete quantos de fato existiam e foram removidos.
 */
export class DeleteManyTransactionsUseCase {
  private readonly transactions: TransactionRepository;

  public constructor(transactions: TransactionRepository) {
    this.transactions = transactions;
  }

  public async execute(rawInput: unknown): Promise<DeleteManyTransactionsResult> {
    const parsed = deleteManyTransactionsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir varias transacoes', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const deletedIds: string[] = [];
    for (const id of input.ids) {
      const existing = await this.transactions.findById(input.userId, id);
      if (!existing) continue;
      await this.transactions.delete(input.userId, id);
      deletedIds.push(id);
    }

    return { deletedCount: deletedIds.length, deletedIds };
  }
}
