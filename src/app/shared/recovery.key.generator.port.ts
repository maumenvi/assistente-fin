/**
 * Porta para gerar a chave de recuperacao de conta (spec 002, RF-9c).
 *
 * Mesma razao do `IdGenerator`/`Clock` (rule 8): o caso de uso recebe a chave pronta, nunca
 * gera sozinho - fica deterministico e testavel com um fake. So o hash da chave e
 * persistido; o texto claro so aparece uma vez, na resposta do caso de uso.
 */
export interface RecoveryKeyGenerator {
  /** Devolve uma nova chave de recuperacao (alta entropia, legivel para transcricao). */
  next(): string;
}
