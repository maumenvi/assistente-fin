import { type Account } from '../../domain/account/account.entity.ts';

/**
 * Porta de persistencia de contas (spec 001, RF-20).
 *
 * Toda operacao de leitura/remocao recebe `userId` e so enxerga contas daquele usuario:
 * o isolamento por usuario (RF-16, CA-14) e responsabilidade do repositorio, nao da borda.
 * O dominio depende apenas desta interface - trocar de banco toca so os adaptadores.
 */
export interface AccountRepository {
  /** Insere ou atualiza a conta (chave: `account.id`). */
  save(account: Account): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<Account | null>;

  /** Lista as contas do usuario, ordenadas por nome. */
  listByUser(userId: string): Promise<Account[]>;

  /** Remove a conta do usuario. Silencioso se ela nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
