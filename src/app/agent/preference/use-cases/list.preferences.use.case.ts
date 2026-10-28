import { type Preference } from '../../../../domain/preference/preference.ts';
import { type PreferenceStoresPort } from '../../ports/preference/preference.stores.port.ts';
import { listPreferencesInputSchema } from './preference.input.schemas.ts';
import { parsePreferenceInput } from './parse.preference.input.ts';

/** Lista as preferencias do usuario (spec 032, FR-011): a tela e o agente mostram o mesmo conteudo. */
export class ListPreferencesUseCase {
  private readonly stores: PreferenceStoresPort;

  public constructor(stores: PreferenceStoresPort) {
    this.stores = stores;
  }

  public async execute(rawInput: unknown): Promise<Preference[]> {
    const { userId, status } = parsePreferenceInput(listPreferencesInputSchema, rawInput, 'listar preferencias');
    return this.stores.preferences.list(userId, status === undefined ? undefined : { status });
  }
}
