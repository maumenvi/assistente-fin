import { type Account } from '../../domain/account/account.entity.ts';
import { type AccountRepository } from '../../app/account/account.repository.port.ts';
import { optimisticStamp } from '../shared/optimistic.lock.ts';

/**
 * Adaptador falso (test double) de `AccountRepository`, com estado em memoria de processo.
 *
 * Usado em desenvolvimento offline e nos testes, e como alvo da suite de contrato que todo
 * banco real (Postgres/Prisma) tera de passar (CA-19, CA-20). Chamado "fake", nao "memory",
 * porque "memoria" no dominio deste app passa a nomear o contexto/preferencias do futuro
 * agente conselheiro financeiro (spec, secao 6) - nomes distintos evitam ambiguidade.
 */
export class FakeAccountRepository implements AccountRepository {
  /** Contas indexadas por id. */
  private readonly byId = new Map<string, Account>();

  public async save(account: Account): Promise<void> {
    this.byId.set(account.id, optimisticStamp(this.byId.get(account.id), account, 'conta'));
  }

  public async findById(userId: string, id: string): Promise<Account | null> {
    const account = this.byId.get(id);
    return account && account.userId === userId ? account : null;
  }

  public async listByUser(userId: string): Promise<Account[]> {
    return [...this.byId.values()]
      .filter((account) => account.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async delete(userId: string, id: string): Promise<void> {
    const account = this.byId.get(id);
    if (account && account.userId === userId) {
      this.byId.delete(id);
    }
  }
}
