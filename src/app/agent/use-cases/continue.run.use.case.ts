import { type SendMessageUseCase } from './send.message.use.case.ts';
import { type SendMessageResult } from './send.message.result.ts';

/**
 * Continua uma execucao pausada por limite de passos ou de tokens do ponto onde parou
 * (spec 038, FR-009), estendendo o orcamento e retomando o checkpoint salvo.
 */
export class ContinueRunUseCase {
  private readonly sender: SendMessageUseCase;

  public constructor(sender: SendMessageUseCase) {
    this.sender = sender;
  }

  public execute(rawInput: unknown): Promise<SendMessageResult> {
    return this.sender.continueRun(rawInput);
  }
}

