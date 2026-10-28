import { PlanError } from './plan.error.ts';

/** politica de autonomia invalida. */
export class PlanPolicyViolationError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_POLICY_VIOLATION', detail ? `politica de autonomia invalida: ${detail}` : 'politica de autonomia invalida');
  }
}
