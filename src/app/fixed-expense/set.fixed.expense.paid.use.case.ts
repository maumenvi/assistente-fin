import { z } from 'zod';
import { type FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { FixedExpenseNotFoundError } from '../../domain/fixed-expense/fixed.expense.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { setFixedExpensePaidInputSchema } from './set.fixed.expense.paid.input.schema.ts';

/**
 * Caso de uso "marcar gasto fixo pago / nao pago" (spec 002, RF-18, 001/RF-3).
 *
 * Usa as transicoes da entidade (`markAsPaid`/`markAsUnpaid`, idempotentes) - preservam
 * `updatedAt`. `expectedUpdatedAt` opcional aplica a trava otimista (RF-31) tambem aqui.
 *
 * **Nao mexe em `Transaction` (spec 021, RF-58)**: da spec 015 ate a 021, marcar pago CRIAVA
 * uma transacao vinculada e desmarcar a APAGAVA - era o que fazia o gasto fixo contar nos
 * totais, que so somavam `Transaction`s reais. A consequencia era que um gasto fixo NAO pago
 * nao existia como gasto em lugar nenhum ("os gastos nao estao completos").
 *
 * Desde a spec 021 o gasto fixo conta por si, pelo `expectedAmount`, pago ou nao (RF-57), e
 * `paid` virou apenas um marcador de controle - "ja quitei este". Este caso de uso, portanto,
 * so grava a flag. As transacoes vinculadas que sobraram das marcacoes antigas continuam no
 * banco e sao ignoradas no calculo de gasto por `isFixedExpenseTransaction` (RF-60).
 */
export class SetFixedExpensePaidUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<FixedExpense> {
    const parsed = setFixedExpensePaidInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('marcar gasto fixo', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.database.fixedExpenses.findById(input.userId, input.id);
    if (!existing) {
      throw new FixedExpenseNotFoundError();
    }

    const toggled = input.paid ? existing.markAsPaid() : existing.markAsUnpaid();
    const updated =
      input.expectedUpdatedAt !== undefined
        ? toggled.withUpdatedAt(new Date(input.expectedUpdatedAt))
        : toggled;

    await this.database.fixedExpenses.save(updated);

    // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31).
    return (await this.database.fixedExpenses.findById(input.userId, input.id)) ?? updated;
  }
}
