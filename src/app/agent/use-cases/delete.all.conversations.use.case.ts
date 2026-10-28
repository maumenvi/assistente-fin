import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { type PreferenceStorePort } from '../ports/preference/preference.store.port.ts';
import { type ActiveRuns } from '../runs/active.runs.ts';
import { userInputSchema } from './user.input.schema.ts';

/** Apaga TODO o historico do usuario (conversas, execucoes e passos). A confirmacao reforcada e da tela. */
export class DeleteAllConversationsUseCase {
  private readonly store: AgentStorePort;
  private readonly runs: ActiveRuns;
  private readonly preferences: PreferenceStorePort | undefined;

  public constructor(store: AgentStorePort, runs: ActiveRuns, preferences?: PreferenceStorePort) {
    this.store = store;
    this.runs = runs;
    this.preferences = preferences;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const parsed = userInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('apagar todo o historico', flat.fieldErrors, flat.formErrors);
    }
    this.runs.cancelAll();
    const { userId } = parsed.data;
    if (this.preferences !== undefined) {
      const conversations = await this.store.conversations.list(userId, { limit: 100_000 });
      for (const conversation of conversations) await this.preferences.markSourceRemoved(userId, conversation.id);
    }
    await this.store.attachments.deleteAll(userId);
    await this.store.conversations.deleteAll(userId);
  }
}
