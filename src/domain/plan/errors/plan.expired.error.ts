import { PlanError } from './plan.error.ts';

/** plano vencido. */
export class PlanExpiredError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_EXPIRED', detail ? `plano vencido: ${detail}` : 'plano vencido');
  }
}
