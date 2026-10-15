import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type Category } from '../../domain/category/category.entity.ts';
import { type CategoryName } from '../../domain/category/category.name.value.object.ts';
import { type CategoryRepository } from '../../app/category/category.repository.port.ts';

/** Adaptador falso (test double) de `CategoryRepository`, com estado em memoria de processo. */
export class FakeCategoryRepository implements CategoryRepository {
  /** Categorias indexadas por id. */
  private readonly byId = new Map<string, Category>();

  public async save(category: Category): Promise<void> {
    this.byId.set(category.id, optimisticStamp(this.byId.get(category.id), category, 'categoria'));
  }

  public async findById(userId: string, id: string): Promise<Category | null> {
    const category = this.byId.get(id);
    return category && category.userId === userId ? category : null;
  }

  public async findByName(userId: string, name: CategoryName): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.name.equals(name)) ?? null;
  }

  public async findDefault(userId: string): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.isDefault) ?? null;
  }

  public async findSystemBalance(userId: string): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.isSystemBalance) ?? null;
  }

  public async findSystemOpeningBalance(userId: string): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.isSystemOpeningBalance) ?? null;
  }

  public async findSystemAdjustment(userId: string): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.isSystemAdjustment) ?? null;
  }

  public async findSystemTransfer(userId: string): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.isSystemTransfer) ?? null;
  }

  public async findSystemCardPayment(userId: string): Promise<Category | null> {
    return this.ofUser(userId).find((category) => category.isSystemCardPayment) ?? null;
  }

  public async listByUser(userId: string): Promise<Category[]> {
    // Ordena por code point (nao `localeCompare`): e a ordem que o Postgres da com o
    // `ORDER BY name` das colacoes usadas aqui, entao os dois adaptadores concordam.
    return this.ofUser(userId).sort((a, b) => (a.name.value < b.name.value ? -1 : 1));
  }

  private ofUser(userId: string): Category[] {
    return [...this.byId.values()].filter((category) => category.userId === userId);
  }
}
