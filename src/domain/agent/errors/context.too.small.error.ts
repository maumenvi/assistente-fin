import { AgentError } from './agent.error.ts';

/** A janela de contexto do modelo e menor que o minimo exigido pelo assistente. */
export class ContextTooSmallError extends AgentError {
  public readonly detectedTokens: number;
  public readonly minTokens: number;

  public constructor(detectedTokens: number, minTokens: number) {
    super('CONTEXT_TOO_SMALL', `janela de contexto de ${detectedTokens} tokens; o minimo e ${minTokens}`);
    this.detectedTokens = detectedTokens;
    this.minTokens = minTokens;
  }
}
