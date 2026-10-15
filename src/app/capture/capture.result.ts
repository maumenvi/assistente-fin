import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { type CaptureDecision } from './capture.decision.ts';

/** Resultado de uma captura (spec 027): o pre-registro afetado (`null` se ja resolvido) e a decisao. */
export interface CaptureResult {
  readonly preRegistration: PreRegistration | null;
  readonly decision: CaptureDecision;
}
