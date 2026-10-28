import { CategoryName } from '../../../../domain/category/category.name.value.object.ts';
import { type Transaction } from '../../../../domain/transaction/transaction.entity.ts';
import { type ApplyContext, type OperationContext } from './operation.context.ts';
import { type WatchRef } from './watch.ref.ts';

/** Escolha de categoria vinda do modelo: por id (de `list_categories`) ou por nome. */
export interface CategoryChoice {
  readonly categoryId?: string | undefined;
  readonly categoryName?: string | undefined;
}

export async function accountLabel(ctx: OperationContext, id: string): Promise<string> {
  return (await ctx.db.accounts.findById(ctx.userId, id))?.name ?? id;
}

export async function categoryLabel(ctx: OperationContext, id: string): Promise<string> {
  return (await ctx.db.categories.findById(ctx.userId, id))?.name.value ?? id;
}

/** Nome valido de categoria, ou `null` quando o dominio o recusa. */
export function safeCategoryName(name: string): CategoryName | null {
  try {
    return CategoryName.create(name);
  } catch {
    return null;
  }
}

/**
 * Troca o nome pelo id quando a categoria ja existe (sem criar nada na proposta). Nome que nao
 * existe continua como `categoryName`: a criacao so acontece na aplicacao, rastreada em `touched`.
 */
export async function resolveCategory(ctx: OperationContext, choice: CategoryChoice): Promise<CategoryChoice> {
  if (choice.categoryId !== undefined) return { categoryId: choice.categoryId };
  if (choice.categoryName === undefined) return {};
  const name = safeCategoryName(choice.categoryName);
  const existing = name === null ? null : await ctx.db.categories.findByName(ctx.userId, name);
  return existing === null ? { categoryName: choice.categoryName } : { categoryId: existing.id };
}

/** Na aplicacao: cria a categoria que nao existia (pelo caso de uso) e devolve o id e o que foi criado. */
export async function ensureCategory(ctx: ApplyContext, choice: CategoryChoice): Promise<{ readonly categoryId: string | undefined; readonly created: WatchRef[] }> {
  if (choice.categoryId !== undefined) return { categoryId: choice.categoryId, created: [] };
  if (choice.categoryName === undefined) return { categoryId: undefined, created: [] };
  const name = safeCategoryName(choice.categoryName);
  const existing = name === null ? null : await ctx.db.categories.findByName(ctx.userId, name);
  if (existing !== null) return { categoryId: existing.id, created: [] };
  const category = await ctx.writers.createCategory.execute({ userId: ctx.userId, name: choice.categoryName });
  return { categoryId: category.id, created: [{ entity: 'category', id: category.id }] };
}

/** Rotulo da categoria escolhida: o nome da existente, ou "NOME (nova)" quando a aplicacao vai cria-la. */
export async function choiceLabel(ctx: OperationContext, choice: CategoryChoice, fallback = ''): Promise<string> {
  if (choice.categoryId !== undefined) return categoryLabel(ctx, choice.categoryId);
  if (choice.categoryName === undefined) return fallback;
  return `${safeCategoryName(choice.categoryName)?.value ?? choice.categoryName} (nova)`;
}

/**
 * Lancamento que ligado a serie, parcelamento, transferencia ou pagamento de fatura mexe em outros
 * registros: fora do alcance do agente nesta versao (recusado com orientacao).
 */
export function transactionBlockReason(tx: Transaction): string | null {
  if (tx.seriesId !== null) return 'o lancamento faz parte de uma recorrencia; altere pela tela';
  if (tx.installmentGroupId !== null) return 'o lancamento e uma parcela; altere pela tela';
  if (tx.transferGroupId !== null) return 'o lancamento e uma transferencia; altere pela tela';
  if (tx.cardPaymentGroupId !== null) return 'o lancamento e um pagamento de fatura; altere pela tela';
  return null;
}
