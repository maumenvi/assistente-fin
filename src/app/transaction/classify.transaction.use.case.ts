import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { TransactionNotFoundError } from '../../domain/transaction/transaction.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { classifyTransactionInputSchema } from './classify.transaction.input.schema.ts';

/**
 * Caso de uso "classificar transacao" (spec 001, RF-6, CA-6).
 *
 * Busca a transacao no escopo do usuario (RF-16); `TransactionNotFoundError` se nao existir
 * ou for de outro usuario (CA-14) - mesmo padrao de `UpdateAccountUseCase`. Editar dado ja
 * existente nao exige usuario verificado (decisao 9 do plano: so criar exige).
 *
 * Desde a spec 003 classificar e apenas trocar o `categoryId` (RF-13): a transacao ja nasce
 * com uma categoria - a padrao, quando o usuario nao informou nada -, entao nao ha um estado
 * "sem categoria" a preencher, e sim um vinculo a mudar. Como a entidade nao tem transicao
 * para isso, reconstroi via `fromPersistence` preservando o resto.
 */
export class ClassifyTransactionUseCase {
  private readonly transactions: TransactionRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(
    transactions: TransactionRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
  ) {
    this.transactions = transactions;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Transaction> {
    const parsed = classifyTransactionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('classificar transacao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.transactions.findById(input.userId, input.id);
    if (!existing) {
      throw new TransactionNotFoundError();
    }

    const categoryId = await resolveCategoryId(this.categories, this.ids, input);
    const classified = Transaction.fromPersistence({
      id: existing.id,
      userId: existing.userId,
      date: existing.date,
      amount: existing.amount,
      type: existing.type,
      categoryId,
      accountId: existing.accountId,
      notes: existing.notes,
      recurrence: existing.recurrence,
      seriesId: existing.seriesId,
      updatedAt: existing.updatedAt,
    });
    await this.transactions.save(classified);
    // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31).
    return (await this.transactions.findById(input.userId, input.id)) ?? classified;
  }
}
