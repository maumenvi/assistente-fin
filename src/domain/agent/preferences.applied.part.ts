/** Preferencias incluidas no contexto daquela resposta (spec 032, US1 cenario 1): o chip "aplicadas". */
export interface PreferencesAppliedPart {
  readonly type: 'preferences_applied';
  readonly ids: readonly string[];
}
