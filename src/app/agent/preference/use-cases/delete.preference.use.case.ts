import { parsePreferenceInput } from './parse.preference.input.ts';
import { type PreferenceUseCaseDeps } from './preference.use.case.deps.ts';
import { deletePreferenceInputSchema } from './preference.input.schemas.ts';

/** Apaga uma preferencia (a confirmacao e da tela). Some dos dois aparelhos pelo sync. Idempotente. */
export class DeletePreferenceUseCase {
  private readonly deps: PreferenceUseCaseDeps;

  public constructor(deps: PreferenceUseCaseDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const { userId, id } = parsePreferenceInput(deletePreferenceInputSchema, rawInput, 'apagar preferencia');
    await this.deps.stores.preferences.delete(userId, id);
  }
}
