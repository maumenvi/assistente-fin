import { type CaptureDiagnostic } from './capture.diagnostic.ts';

/** Limite de linhas do log de diagnostico (as mais antigas saem). */
export const CAPTURE_DIAGNOSTICS_LIMIT = 200;

/**
 * TEMPORARIO (spec 027, FR-012) - remover em spec futura. Log local das notificacoes da carteira,
 * fora da porta `Database` (como os rascunhos): nunca sincroniza nem sai do aparelho sozinho.
 */
export interface CaptureDiagnosticsStore {
  /** Acrescenta uma linha, mantendo no maximo `CAPTURE_DIAGNOSTICS_LIMIT`. */
  append(entry: CaptureDiagnostic): Promise<void>;
  /** Linhas, mais recentes primeiro. */
  list(): Promise<CaptureDiagnostic[]>;
}
