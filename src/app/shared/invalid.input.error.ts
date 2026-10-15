/**
 * Falha de validacao de entrada externa na fronteira da aplicacao (rule 11).
 *
 * Carrega os erros ja achatados do zod (`fieldErrors` / `formErrors`) para a borda
 * traduzir em resposta 400 / mensagem de formulario. Nao e um `DomainError`: representa
 * dado malformado, nao uma regra de negocio violada.
 */
export class InvalidInputError extends Error {
  public readonly code = 'INVALID_INPUT';
  public readonly context: string;
  public readonly fieldErrors: Record<string, string[]>;
  public readonly formErrors: string[];

  public constructor(
    context: string,
    fieldErrors: Record<string, string[]>,
    formErrors: string[] = [],
  ) {
    super(`entrada invalida em ${context}`);
    this.name = 'InvalidInputError';
    this.context = context;
    this.fieldErrors = fieldErrors;
    this.formErrors = formErrors;
  }
}
