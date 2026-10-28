import { parsePreferenceInput } from './parse.preference.input.ts';
import { type PreferenceUseCaseDeps } from './preference.use.case.deps.ts';
import { preferenceUserInputSchema } from './preference.input.schemas.ts';

/**
 * "Apagar tudo" (spec 032, US3 cenario 3): preferencias, candidatas, sinais, recusas e avisos do
 * usuario. O agente volta ao comportamento padrao. A confirmacao reforcada e da tela.
 */
export class DeleteAllPreferencesUseCase {
  private readonly deps: PreferenceUseCaseDeps;

  public constructor(deps: PreferenceUseCaseDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const { userId } = parsePreferenceInput(preferenceUserInputSchema, rawInput, 'apagar todas as preferencias');
    await this.deps.stores.deleteAll(userId);
  }
}
