import { type Category } from '../../domain/category/category.entity.ts';
import { type CategoryName } from '../../domain/category/category.name.value.object.ts';

/**
 * Porta de persistencia de categorias (spec 003, RF-6..RF-8).
 *
 * Toda operacao recebe `userId` e so enxerga categorias daquele usuario - isolamento por
 * usuario (001/RF-16) e responsabilidade do repositorio, nao da borda.
 *
 * **Nao tem `delete`**: a exclusao de categoria nao existe nesta entrega (RF-7, CA-4), e a
 * ausencia do metodo na porta e o que impede um caso de uso futuro de excluir sem passar
 * pela decisao de produto.
 */
export interface CategoryRepository {
  /** Insere ou atualiza a categoria (chave: `category.id`), com trava otimista (RF-31). */
  save(category: Category): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro (CA-30). */
  findById(userId: string, id: string): Promise<Category | null>;

  /**
   * Busca pelo nome dentro do escopo do usuario. Recebe `CategoryName` (nao `string`) porque
   * o nome guardado ja e a forma normalizada: o tipo garante que quem consulta normalizou
   * antes, sem cada adaptador ter que repetir a normalizacao (CA-10).
   *
   * A unicidade por `(userId, name)` e checada pelos casos de uso com esta busca; no Prisma
   * o `@@unique` do banco fica so como rede de seguranca.
   */
  findByName(userId: string, name: CategoryName): Promise<Category | null>;

  /** Categoria padrao do usuario (`isDefault`), ou `null` se ainda nao foi criada (RF-8). */
  findDefault(userId: string): Promise<Category | null>;

  /**
   * Categoria de sistema "SALDO" do usuario (`isSystemBalance`, spec 011, RF-16), ou `null`
   * se ainda nao foi criada.
   */
  findSystemBalance(userId: string): Promise<Category | null>;

  /**
   * Categoria de sistema "SALDO INICIAL" do usuario (`isSystemOpeningBalance`, spec 015), ou
   * `null` se ainda nao foi criada.
   */
  findSystemOpeningBalance(userId: string): Promise<Category | null>;

  /**
   * Categoria de sistema "AJUSTE" do usuario (`isSystemAdjustment`, spec 015), ou `null` se
   * ainda nao foi criada.
   */
  findSystemAdjustment(userId: string): Promise<Category | null>;

  /**
   * Categoria de sistema de transferencia entre contas do usuario (`isSystemTransfer`, spec
   * 016, RF-1), ou `null` se ainda nao foi criada/promovida.
   */
  findSystemTransfer(userId: string): Promise<Category | null>;

  /**
   * Categoria de sistema de pagamento de fatura de cartao do usuario (`isSystemCardPayment`,
   * spec 016, RF-2), ou `null` se ainda nao foi criada.
   */
  findSystemCardPayment(userId: string): Promise<Category | null>;

  /**
   * Lista as categorias do usuario, ordenadas por nome. Ordem exata entre nomes acentuados
   * depende da colacao do banco e nao faz parte do contrato.
   */
  listByUser(userId: string): Promise<Category[]>;
}
