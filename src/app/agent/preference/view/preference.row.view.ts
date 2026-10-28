import { type PreferenceStatus } from '../../../../domain/preference/preference.status.ts';

/** Uma linha das abas da tela de preferencias (spec 032, D10/M11). */
export interface PreferenceRowView {
  readonly id: string;
  readonly text: string;
  readonly status: Exclude<PreferenceStatus, 'disabled'>;
  readonly scopeLabel: string;
  readonly originLabel: string;
  readonly lastUsedLabel: string;
  readonly isPrivate: boolean;
  /** Afeta dinheiro ou dados: so vale depois de ativa. */
  readonly affectsData: boolean;
  /** Candidata ou tentativa aprendida ainda nao confirmada: leva a marca "nova". */
  readonly isNew: boolean;
  readonly sourceRemoved: boolean;
  readonly topicLabel: string;
}
