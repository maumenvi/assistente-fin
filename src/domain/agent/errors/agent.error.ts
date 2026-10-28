import { DomainError } from '../../shared/domain.error.ts';

/**
 * Base dos erros do agente (spec 031, constituicao IV). `retriable` diz se a mesma chamada pode
 * ser repetida automaticamente; a borda traduz o `code` em mensagem para o usuario.
 */
export abstract class AgentError extends DomainError {
  /** Verdadeiro quando repetir a chamada pode dar certo (rede, limite de taxa). */
  public readonly retriable: boolean;

  protected constructor(code: string, message: string, retriable = false) {
    super(code, message);
    this.retriable = retriable;
  }
}
