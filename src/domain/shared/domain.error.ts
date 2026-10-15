/**
 * Erro base do dominio.
 *
 * Rule 12: falhas previsiveis do negocio viram classes de erro. A borda (UI, CLI, HTTP)
 * traduz cada subclasse em status/mensagem. Nunca usada para bugs de programacao - para
 * isso vale um `throw` comum ou `assert`.
 *
 * `code` e um identificador estavel e legivel por maquina (ex: `INVALID_CPF`) usado pela
 * borda para mapear resposta e i18n sem depender da `message`.
 */
export abstract class DomainError extends Error {
  /** Identificador estavel do erro, em SCREAMING_SNAKE_CASE. */
  public readonly code: string;

  protected constructor(code: string, message: string) {
    super(message);
    this.code = code;
    // Mantem o nome da subclasse concreta em stack traces e logs.
    this.name = new.target.name;
  }
}
