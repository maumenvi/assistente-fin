import { AgentError } from './agent.error.ts';

/**
 * Base dos erros da camada de LLM. `emittedContent` diz se ja saiu texto ou chamada de ferramenta
 * antes da falha: so erros ANTES de qualquer conteudo podem ser retentados sem duplicar a resposta.
 */
export abstract class LlmError extends AgentError {
  public readonly emittedContent: boolean;

  protected constructor(code: string, message: string, retriable: boolean, emittedContent: boolean) {
    super(code, message, retriable);
    this.emittedContent = emittedContent;
  }
}
