import { z } from 'zod';
import { PreferenceNotFoundError } from '../../../../domain/preference/errors/preference.not.found.error.ts';
import { dismissPreference } from '../../../../domain/preference/lifecycle/dismiss.preference.ts';
import { keyOfPreference } from '../learn/key.of.preference.ts';
import { type DecideSuggestionDeps } from './decide.suggestion.deps.ts';
import { markSuggestionState } from './mark.suggestion.state.ts';
import { parsePreferenceInput } from './parse.preference.input.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1), id: z.string().trim().min(1), conversationId: z.string().trim().min(1).optional(), messageId: z.string().trim().min(1).optional() });

/**
 * "Agora nao" na sugestao (spec 032, FR-007): desativa a candidata e LEMBRA a recusa por 90 dias
 * (so evidencia forte volta a sugerir a mesma coisa). A parte da conversa passa a `dismissed`.
 */
export class DismissPreferenceUseCase {
  private readonly deps: DecideSuggestionDeps;

  public constructor(deps: DecideSuggestionDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const input = parsePreferenceInput(inputSchema, rawInput, 'recusar sugestao');
    const current = await this.deps.stores.preferences.get(input.userId, input.id);
    if (current === null) throw new PreferenceNotFoundError();
    const { preference, suppression } = dismissPreference(current, keyOfPreference(current), this.deps.clock.now());
    await this.deps.stores.preferences.save(preference);
    await this.deps.stores.suppressions.put(suppression);
    await markSuggestionState(this.deps.store, input.userId, input.conversationId, input.messageId, input.id, 'dismissed');
  }
}
