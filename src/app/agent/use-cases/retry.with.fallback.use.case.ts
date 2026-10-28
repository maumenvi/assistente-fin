import { type SendMessageUseCase } from './send.message.use.case.ts';
import { type SendMessageResult } from './send.message.result.ts';

/** "Usar modelo alternativo" (spec 031, T115): igual a "Tentar de novo", mas forca o perfil `fallback`. */
export class RetryWithFallbackUseCase {
  private readonly sender: SendMessageUseCase;

  public constructor(sender: SendMessageUseCase) {
    this.sender = sender;
  }

  public execute(rawInput: unknown): Promise<SendMessageResult> {
    const body = rawInput !== null && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {};
    return this.sender.rerun({ ...body, useFallback: true });
  }
}
