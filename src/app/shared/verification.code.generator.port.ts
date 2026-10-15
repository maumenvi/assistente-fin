/**
 * Porta para gerar o codigo numerico de verificacao (spec 001, RF-24).
 *
 * Mesma razao do `IdGenerator`/`Clock` (rule 8): o caso de uso recebe o codigo pronto, nunca
 * gera sozinho - fica deterministico e testavel com um gerador fixo/sequencial nos testes.
 */
export interface VerificationCodeGenerator {
  /** Devolve um novo codigo de verificacao (6 digitos numericos). */
  next(): string;
}
