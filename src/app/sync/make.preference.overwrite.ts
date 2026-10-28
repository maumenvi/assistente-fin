import { type PreferenceOverwrite } from '../../domain/preference/preference.overwrite.ts';

/** O que se perdeu num "ultima escrita vence": a preferencia, o texto da versao perdida e quando foi escrita. */
export interface LostPreferenceVersion {
  readonly userId: string;
  readonly preferenceId: string;
  readonly lostText: string;
  readonly lostAt: string;
  /** Texto da versao que ficou; igual ao perdido = nada a avisar. */
  readonly keptText: string | null;
}

/**
 * Monta o aviso de sobrescrita (spec 032, FR-010), ou `null` quando as duas versoes dizem a mesma
 * coisa. O id e deterministico (`preferencia@instante`), entao reenvios nao duplicam o aviso.
 */
export function makePreferenceOverwrite(lost: LostPreferenceVersion): PreferenceOverwrite | null {
  if (lost.keptText !== null && lost.keptText.trim() === lost.lostText.trim()) return null;
  return {
    id: `${lost.preferenceId}@${lost.lostAt}`,
    userId: lost.userId,
    preferenceId: lost.preferenceId,
    lostText: lost.lostText,
    lostAt: lost.lostAt,
    seenAt: null,
  };
}
