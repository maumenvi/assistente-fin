import { PlanError } from './plan.error.ts';

/** plano ja decidido. */
export class PlanAlreadyDecidedError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_ALREADY_DECIDED', detail ? `plano ja decidido: ${detail}` : 'plano ja decidido');
  }
}
