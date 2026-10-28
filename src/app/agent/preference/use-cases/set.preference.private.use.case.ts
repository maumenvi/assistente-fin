import { PreferenceNotFoundError } from '../../../../domain/preference/errors/preference.not.found.error.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { parsePreferenceInput } from './parse.preference.input.ts';
import { type PreferenceUseCaseDeps } from './preference.use.case.deps.ts';
import { setPreferencePrivateInputSchema } from './preference.input.schemas.ts';

/**
 * Marca uma preferencia como privada (nunca vai a modelo de nuvem) ou a libera (spec 032, FR-023).
 * Vale na proxima resposta; sincroniza.
 */
export class SetPreferencePrivateUseCase {
  private readonly deps: PreferenceUseCaseDeps;

  public constructor(deps: PreferenceUseCaseDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<Preference> {
    const input = parsePreferenceInput(setPreferencePrivateInputSchema, rawInput, 'marcar preferencia privada');
    const current = await this.deps.stores.preferences.get(input.userId, input.id);
    if (current === null) throw new PreferenceNotFoundError();
    if (current.private === input.private) return current;
    const next: Preference = { ...current, private: input.private, updatedAt: this.deps.clock.now().toISOString() };
    await this.deps.stores.preferences.save(next);
    return next;
  }
}
