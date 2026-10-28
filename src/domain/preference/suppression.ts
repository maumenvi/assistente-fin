/**
 * Recusa lembrada (spec 032, FR-007): o agente nao sugere a mesma `key` ate `until`, a menos que
 * a evidencia chegue a `strongEvidenceNeeded` sinais.
 */
export interface Suppression {
  readonly userId: string;
  readonly key: string;
  readonly until: string;
  readonly strongEvidenceNeeded: number;
}
