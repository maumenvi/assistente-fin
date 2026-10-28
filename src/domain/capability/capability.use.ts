/** Registro de uma chamada a capacidade externa (data-model.md 3); retencao de 90 dias. */
export interface CapabilityUse {
  readonly id: string;
  readonly userId: string;
  readonly capabilityId: string;
  readonly runId: string | null;
  readonly at: string;
  readonly tool: string;
  readonly argsJson: string;
  readonly resultSummary: string;
  readonly resultBytes: number;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly errorCode: string | null;
  readonly suspectedInjection: boolean;
  readonly blocked: 'egress' | 'schema' | 'size' | null;
}

export const USE_RETENTION_DAYS = 90;
