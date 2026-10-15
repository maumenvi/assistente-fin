import { type AccessKeyRecord } from './access.key.record.ts';

/**
 * Porta de persistencia da chave de acesso do servidor MCP local (spec 004, RF-13).
 *
 * Uma chave por instalacao (regra do **repositorio**, nao do banco — a tabela nao tem
 * constraint de unicidade sobre "ativa"; ver plano, decisao D1). `replaceActive` e a
 * unica forma de escrita: gera a nova chave ativa e decide o destino da anterior
 * (apagar, ou marcar `revokedAt=now` e mante-la pela janela de graca — R11 do plano).
 */
export interface AccessKeyRepositoryPort {
  /** A chave ativa da instalacao (`revokedAt === null`), ou `null` se nenhuma foi gerada. */
  getActive(): Promise<AccessKeyRecord | null>;

  /**
   * Registros que ainda autenticam em `now`: a ativa (se houver) mais, quando aplicavel,
   * a chave da rotacao anterior dentro da sua janela de graca. No maximo 2 linhas.
   */
  listValidNow(now: Date): Promise<AccessKeyRecord[]>;

  /**
   * Substitui a chave ativa por uma nova, associada a `userId`, com o hash `keyHash`.
   *
   * O repositorio nunca le o relogio — quem chama (`GenerateAccessKeyService`, que ja
   * tem um `Clock` injetado) calcula os instantes e os passa prontos (mesmo padrao do
   * resto do app: casos de uso computam datas, o repositorio so persiste).
   *
   * `opts.previousRevokedAt` presente: a chave anterior (se houver) e mantida, com
   * `revokedAt` = esse instante — o momento em que ela **deixa** de valer
   * (`listValidNow` a inclui enquanto `now < revokedAt`). Ausente: a chave anterior e
   * apagada (revogacao imediata, sem janela).
   */
  replaceActive(
    userId: string,
    keyHash: string,
    opts?: { readonly previousRevokedAt?: Date },
  ): Promise<void>;
}
