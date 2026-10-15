import { z } from 'zod';
import { type FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { FixedExpenseNotFoundError } from '../../domain/fixed-expense/fixed.expense.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { deleteFixedExpenseInputSchema } from './delete.fixed.expense.input.schema.ts';

/**
 * Caso de uso "excluir gasto fixo" (spec 002, RF-18). Busca no escopo do usuario antes de
 * remover pra devolver `FixedExpenseNotFoundError` (CA-14). Devolve o gasto removido.
 *
 * **Apaga junto a Transaction vinculada (spec 021, RF-62)**: `Transaction.fixedExpenseId` nao
 * tem `onDelete: Cascade` (schema Prisma), entao excluir um gasto fixo que tenha transacao
 * vinculada falharia com erro de FK. Por isso, dentro da mesma `database.transaction()`,
 * remove primeiro essa transacao (se houver) e so entao o gasto fixo.
 *
 * O MOTIVO mudou na spec 021: ate a spec 015, quem criava essa transacao era o proprio app,
 * ao marcar o gasto como pago. Desde a 021 isso nao acontece mais (RF-58) - as transacoes
 * vinculadas que existem sao historico das marcacoes antigas, e este caso de uso continua
 * precisando limpa-las para nao deixar registro orfao.
 */
export class DeleteFixedExpenseUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<FixedExpense> {
    const parsed = deleteFixedExpenseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir gasto fixo', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.database.fixedExpenses.findById(input.userId, input.id);
    if (!existing) {
      throw new FixedExpenseNotFoundError();
    }

    await this.database.transaction(async (tx) => {
      const linked = await tx.transactions.findByFixedExpenseId(input.userId, input.id);
      if (linked) {
        await tx.transactions.delete(input.userId, linked.id);
      }
      await tx.fixedExpenses.delete(input.userId, input.id);
    });

    return existing;
  }
}
