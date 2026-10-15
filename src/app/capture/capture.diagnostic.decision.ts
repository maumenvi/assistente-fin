/** TEMPORARIO (spec 027, FR-012) - remover em spec futura. O que a captura fez com a notificacao. */
export const CAPTURE_DIAGNOSTIC_DECISIONS = ['created', 'filled', 'merged-by-content', 'ignored-edited', 'ignored-resolved', 'ignored-summary', 'error'] as const;

/** Um dos valores de `CAPTURE_DIAGNOSTIC_DECISIONS`. */
export type CaptureDiagnosticDecision = (typeof CAPTURE_DIAGNOSTIC_DECISIONS)[number];
