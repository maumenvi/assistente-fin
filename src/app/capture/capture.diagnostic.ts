import { type CaptureDiagnosticDecision } from './capture.diagnostic.decision.ts';

/**
 * TEMPORARIO (spec 027, FR-012) - remover em spec futura. Uma notificacao da carteira recebida e a
 * decisao tomada. Sem titulo nem texto da notificacao: so identidade, horarios e decisao.
 */
export interface CaptureDiagnostic {
  readonly at: Date;
  readonly notificationKey: string | null;
  readonly when: number | null;
  readonly postTime: number;
  readonly groupSummary: boolean;
  readonly captureKey: string | null;
  /** Valor lido da notificacao (spec 028); `null` quando ausente. */
  readonly amountCents: number | null;
  /** Estabelecimento interpretado (nunca o texto bruto); `null` quando ausente. */
  readonly description: string | null;
  readonly decision: CaptureDiagnosticDecision;
  readonly preRegistrationId: string | null;
}
