import { reconcilePreferences } from '../reconcile.preferences.ts';
import { parsePreferenceInput } from './parse.preference.input.ts';
import { type PreferenceUseCaseDeps } from './preference.use.case.deps.ts';
import { preferenceUserInputSchema } from './preference.input.schemas.ts';
import { type PreferencesScreenData } from './preferences.screen.data.ts';

/**
 * Dados da tela de preferencias (spec 032, US3): as preferencias (sem as desativadas e substituidas
 * saem na tela, nao daqui), os avisos nao vistos e as contas/categorias para os rotulos de escopo.
 * Reconcilia conflitos antes de ler, entao o que a tela mostra e o que o agente usa.
 */
export class GetPreferencesScreenUseCase {
  private readonly deps: PreferenceUseCaseDeps;

  public constructor(deps: PreferenceUseCaseDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<PreferencesScreenData> {
    const { userId } = parsePreferenceInput(preferenceUserInputSchema, rawInput, 'ver preferencias');
    const { stores, clock } = this.deps;
    await reconcilePreferences(stores, userId, clock.now());
    const [preferences, notices, entities] = await Promise.all([stores.preferences.list(userId), stores.overwrites.listUnseen(userId), this.deps.entities(userId)]);
    return { preferences, notices, accounts: entities.accounts, categories: entities.categories };
  }
}
