import { type PasswordHasher } from '../../src/app/shared/password.hasher.port.ts';

/**
 * `PasswordHasher` deterministico para testes: `hash(p) === "hashed:" + p`. Sem cripto de
 * verdade - so o suficiente pra exercitar os casos de uso sem o custo do scrypt.
 */
export class FakePasswordHasher implements PasswordHasher {
  public async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  public async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}
