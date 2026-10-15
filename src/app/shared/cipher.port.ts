/**
 * Cifra simetrica autenticada para dados sensiveis EM REPOUSO (spec 001, RF-24; revisao
 * Fase 4). Hoje so os codigos de verificacao passam por aqui - o adaptador Prisma cifra
 * antes de gravar e decifra ao ler, de forma transparente pro dominio e pros casos de uso.
 *
 * Injetada por DI (mesmo padrao de `PasswordHasher`): a implementacao real (`AesGcmCipher`,
 * chave de 32 bytes vinda do ambiente) vive em `libs/crypto/`; os testes usam um `fake`.
 *
 * Diferente de `PasswordHasher`: aqui e reversivel de proposito - o codigo precisa voltar
 * ao texto claro pra ser comparado com o que o usuario digitou e pra ser enviado.
 */
export interface Cipher {
  /** Cifra `plaintext` e devolve um envelope autocontido (texto, seguro pra coluna String). */
  encrypt(plaintext: string): string;

  /** Decifra um envelope produzido por `encrypt`. Lanca se a integridade nao confere. */
  decrypt(ciphertext: string): string;
}
