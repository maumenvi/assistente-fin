import { optimisticStamp } from '../shared/optimistic.lock.ts';
import { type User } from '../../domain/user/user.entity.ts';
import { type Cpf } from '../../domain/shared/cpf.value.object.ts';
import { type Email } from '../../domain/shared/email.value.object.ts';
import { type Phone } from '../../domain/shared/phone.value.object.ts';
import { type UserRepository } from '../../app/user/user.repository.port.ts';

/** Adaptador falso (test double) de `UserRepository`, com estado em memoria de processo. */
export class FakeUserRepository implements UserRepository {
  /** Usuarios indexados por id. */
  private readonly byId = new Map<string, User>();

  public async save(user: User): Promise<void> {
    this.byId.set(user.id, optimisticStamp(this.byId.get(user.id), user, 'usuario'));
  }

  public async listAll(): Promise<User[]> {
    return [...this.byId.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name),
    );
  }

  public async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  public async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  public async findByCpf(cpf: Cpf): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.cpf.equals(cpf)) return user;
    }
    return null;
  }

  public async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.email.equals(email)) return user;
    }
    return null;
  }

  public async findByPhone(phone: Phone): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.phone.equals(phone)) return user;
    }
    return null;
  }
}
