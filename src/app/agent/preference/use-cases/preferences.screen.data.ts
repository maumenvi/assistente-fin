import { type Preference } from '../../../../domain/preference/preference.ts';
import { type PreferenceOverwrite } from '../../../../domain/preference/preference.overwrite.ts';
import { type NamedEntity } from '../../../../domain/preference/select/select.context.ts';

/** Tudo de que a tela de preferencias precisa numa chamada (spec 032, D10/M11). */
export interface PreferencesScreenData {
  readonly preferences: readonly Preference[];
  /** Avisos de sobrescrita ainda nao vistos (conflito de topico ou edicao em outro aparelho). */
  readonly notices: readonly PreferenceOverwrite[];
  readonly accounts: readonly NamedEntity[];
  readonly categories: readonly NamedEntity[];
}
