import { LlmError } from './llm.error.ts';

/**
 * Sem rede, provedor fora do ar, timeout ou silencio no stream. Quando a causa e a CONEXAO
 * (`offline`: DNS, conexao recusada, reset), o codigo e `OFFLINE` - a tela mostra "sem conexao" em
 * vez de "provedor indisponivel". Os dois sao retentaveis antes de qualquer conteudo.
 */
export class LlmUnavailableError extends LlmError {
  public readonly offline: boolean;

  public constructor(message = 'modelo indisponivel', emittedContent = false, offline = false) {
    super(offline ? 'OFFLINE' : 'LLM_UNAVAILABLE', message, true, emittedContent);
    this.offline = offline;
  }
}
