import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1, 'userId obrigatorio') });

/** Apaga o historico de execucoes (e passos) do usuario; as conversas ficam. A confirmacao e da tela. */
export class DeleteAllRunsUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('apagar execucoes', flat.fieldErrors, flat.formErrors);
    }
    await this.store.runs.deleteAll(parsed.data.userId);
  }
}
