import { confirmPreference } from '../../../../domain/preference/lifecycle/confirm.preference.ts';
import { PreferenceNotFoundError } from '../../../../domain/preference/errors/preference.not.found.error.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { z } from 'zod';
import { type DecideSuggestionDeps } from './decide.suggestion.deps.ts';
import { markSuggestionState } from './mark.suggestion.state.ts';
import { parsePreferenceInput } from './parse.preference.input.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1), id: z.string().trim().min(1), conversationId: z.string().trim().min(1).optional(), messageId: z.string().trim().min(1).optional() });

/**
 * "Manter" na sugestao (spec 032, FR-005): a candidata ou tentativa vira `active`, com confianca
 * alta, e a parte da conversa passa a `confirmed`. Um toque; vale nos dois aparelhos pelo sync.
 */
export class ConfirmPreferenceUseCase {
  private readonly deps: DecideSuggestionDeps;

  public constructor(deps: DecideSuggestionDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<Preference> {
    const input = parsePreferenceInput(inputSchema, rawInput, 'confirmar preferencia');
    const current = await this.deps.stores.preferences.get(input.userId, input.id);
    if (current === null) throw new PreferenceNotFoundError();
    const confirmed = current.status === 'active' ? current : confirmPreference(current, this.deps.clock.now());
    if (confirmed !== current) await this.deps.stores.preferences.save(confirmed);
    await markSuggestionState(this.deps.store, input.userId, input.conversationId, input.messageId, input.id, 'confirmed');
    return confirmed;
  }
}
