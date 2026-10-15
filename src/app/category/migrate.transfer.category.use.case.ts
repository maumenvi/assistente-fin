import { z } from 'zod';
import { type Category } from '../../domain/category/category.entity.ts';
import { TRANSFER_CATEGORY_NAME } from '../../domain/category/transfer.category.name.ts';
import {
  AmbiguousTransferCategoryError,
  type AmbiguousTransferCategoryCandidate,
} from '../../domain/category/ambiguous.transfer.category.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureTransferCategory } from './ensure.transfer.category.ts';
import { migrateTransferCategoryInputSchema } from './migrate.transfer.category.input.schema.ts';

/** Resultado de `MigrateTransferCategoryUseCase`. */
export type MigrateTransferCategoryResult =
  | { readonly outcome: 'created'; readonly category: Category }
  | { readonly outcome: 'promoted'; readonly category: Category };

/**
 * Caso de uso "migrar categoria de transferência" (spec 016, RF-10) - idempotente e
 * disparado manualmente (nunca automatico no boot, decisao do usuario): promove a categoria
 * "TRANSFERÊNCIAS" pré-existente do usuário para carregar `isSystemTransfer: true`,
 * preservando seu `id` (nenhum lançamento vinculado é tocado - `Transaction.categoryId` não
 * muda).
 *
 * Compara pelo nome já normalizado (`CategoryName`, mesma regra do domínio) contra
 * `TRANSFER_CATEGORY_NAME` - uma das duas únicas comparações por nome no código desta spec
 * (a outra é `ensureTransferCategory`, ver `transfer.category.name.ts`), porque é exatamente
 * essa a migração de dados que torna a flag a identificação estável dali em diante. Esta
 * versão trata também os casos 0 e 2+ candidatas que `ensureTransferCategory` não resolve
 * sozinho:
 *
 * - **0 candidatas**: chama `ensureTransferCategory` (cria a categoria sistêmica do zero).
 * - **1 candidata**: promove ela mesma, preservando `id` - `category.save` com
 *   `isSystemTransfer: true`.
 * - **2 ou mais candidatas**: não escolhe nem mescla nada automaticamente - lança
 *   `AmbiguousTransferCategoryError` com o diagnóstico (`candidates`) para resolução manual;
 *   nenhuma categoria é tocada.
 */
export class MigrateTransferCategoryUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<MigrateTransferCategoryResult> {
    const parsed = migrateTransferCategoryInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('migrar categoria de transferencia', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const [categories, transactions] = await Promise.all([
      this.database.categories.listByUser(input.userId),
      this.database.transactions.listByUser(input.userId),
    ]);
    const candidates = categories.filter((category) => category.name.value === TRANSFER_CATEGORY_NAME);

    if (candidates.length === 0) {
      const created = await ensureTransferCategory(this.database.categories, this.ids, input.userId);
      return { outcome: 'created', category: created };
    }

    if (candidates.length > 1) {
      const diagnostics: AmbiguousTransferCategoryCandidate[] = candidates.map((candidate) => ({
        categoryId: candidate.id,
        name: candidate.name.value,
        transactionCount: transactions.filter((tx) => tx.categoryId === candidate.id).length,
      }));
      throw new AmbiguousTransferCategoryError(diagnostics);
    }

    const [existing] = candidates;
    const promoted = existing!.withSystemTransfer();
    await this.database.categories.save(promoted);
    return { outcome: 'promoted', category: promoted };
  }
}
