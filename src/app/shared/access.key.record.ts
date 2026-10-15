/**
 * Linha persistida de uma chave de acesso do servidor MCP local (spec 004, RF-13, RF-17).
 *
 * So o `keyHash` e gravado — o valor em claro nunca chega ao banco (RF-13; existe so no
 * momento da geracao, ver `GenerateAccessKeyService`). `revokedAt` nulo marca a chave
 * **ativa** (sem prazo); nao-nulo marca a chave da rotacao anterior e e o instante em
 * que ela **deixa** de valer (fim da janela de graca — plano, R11): `listValidNow(now)`
 * a inclui enquanto `now < revokedAt`.
 */
export interface AccessKeyRecord {
  readonly id: string;
  readonly userId: string;
  readonly keyHash: string;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}
