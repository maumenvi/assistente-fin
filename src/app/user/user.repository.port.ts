import { type User } from '../../domain/user/user.entity.ts';
import { type Cpf } from '../../domain/shared/cpf.value.object.ts';
import { type Email } from '../../domain/shared/email.value.object.ts';
import { type Phone } from '../../domain/shared/phone.value.object.ts';

/**
 * Porta de persistencia de usuarios (spec 001, RF-15, RF-20, RF-23).
 *
 * `findByCpf`/`findByEmail`/`findByPhone` existem pra o caso de uso checar unicidade antes
 * de criar (CA-13, RF-23). `listAll` serve a tela de selecao de usuario da borda desktop
 * (spec 002, RF-10, RF-11) - o unico consumidor que precisa enumerar todos.
 */
export interface UserRepository {
  /** Insere ou atualiza o usuario (chave: `user.id`). */
  save(user: User): Promise<void>;

  /** Todos os usuarios, do mais antigo para o mais novo (spec 002, RF-10). */
  listAll(): Promise<User[]>;

  /** Remove o usuario. Silencioso se nao existir. (Sem consumidor em producao hoje - a
   * criacao virou transacional; mantido como operacao natural do repositorio.) */
  delete(id: string): Promise<void>;

  /** Busca por id. `null` se nao existir. */
  findById(id: string): Promise<User | null>;

  /** Busca pelo CPF normalizado. `null` se nao existir. */
  findByCpf(cpf: Cpf): Promise<User | null>;

  /** Busca pelo e-mail normalizado. `null` se nao existir. */
  findByEmail(email: Email): Promise<User | null>;

  /** Busca pelo telefone normalizado (E.164). `null` se nao existir. */
  findByPhone(phone: Phone): Promise<User | null>;
}
