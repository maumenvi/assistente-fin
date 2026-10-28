import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { type PreferenceStorePort } from '../ports/preference/preference.store.port.ts';
import { type ActiveRuns } from '../runs/active.runs.ts';
import { deleteConversationInputSchema } from './delete.conversation.input.schema.ts';

/** Apaga uma conversa com mensagens, execucoes, passos e resumo; para a execucao ativa dela, se houver. A confirmacao e da tela. */
export class DeleteConversationUseCase {
  private readonly store: AgentStorePort;
  private readonly runs: ActiveRuns;
  private readonly preferences: PreferenceStorePort | undefined;

  public constructor(store: AgentStorePort, runs: ActiveRuns, preferences?: PreferenceStorePort) {
    this.store = store;
    this.runs = runs;
    this.preferences = preferences;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const parsed = deleteConversationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('apagar conversa', flat.fieldErrors, flat.formErrors);
    }
    const { userId, conversationId } = parsed.data;
    const conversation = await this.store.conversations.get(userId, conversationId);
    if (conversation === null) return;
    this.runs.cancelConversation(conversationId);
    // anexos (spec 036): apagados de forma explicita, alem da cascata do banco
    await this.store.attachments.deleteByConversation(userId, conversationId);
    await this.store.conversations.delete(userId, conversationId);
    // spec 032: a preferencia aprendida/dita nesta conversa permanece, so passa a mostrar "origem removida"
    await this.preferences?.markSourceRemoved(userId, conversationId);
  }
}
