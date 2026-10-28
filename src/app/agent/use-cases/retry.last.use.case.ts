import { type SendMessageUseCase } from './send.message.use.case.ts';
import { type SendMessageResult } from './send.message.result.ts';

/** "Tentar de novo" (spec 031, T115): nova execucao ligada a mesma pergunta; a resposta original permanece. */
export class RetryLastUseCase {
  private readonly sender: SendMessageUseCase;

  public constructor(sender: SendMessageUseCase) {
    this.sender = sender;
  }

  public execute(rawInput: unknown): Promise<SendMessageResult> {
    const body = rawInput !== null && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {};
    return this.sender.rerun({ ...body, useFallback: false });
  }
}
