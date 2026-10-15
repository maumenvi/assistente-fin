/**
 * Porta para derivar e conferir o hash de uma senha (spec 002, RF-9).
 *
 * Mesma razao do `IdGenerator`/`Clock` (rule 8): o caso de uso nunca chama uma primitiva de
 * cripto direto - recebe esta porta por injecao, fica deterministico e testavel com um fake.
 * Assincrona de proposito: derivar a chave e trabalho pesado de CPU (scrypt), nao deve
 * bloquear o event loop.
 *
 * O mesmo hasher serve para a chave de recuperacao de conta (spec 002, RF-9c).
 */
export interface PasswordHasher {
  /** Deriva um hash autocontido (parametros + sal embutidos) a partir do texto claro. */
  hash(plain: string): Promise<string>;

  /** `true` quando `plain` corresponde a `hash`. `false` para hash malformado, nunca lanca. */
  verify(plain: string, hash: string): Promise<boolean>;
}
