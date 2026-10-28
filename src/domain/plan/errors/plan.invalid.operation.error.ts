import { PlanError } from './plan.error.ts';

/** operacao invalida. */
export class PlanInvalidOperationError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_INVALID_OPERATION', detail ? `operacao invalida: ${detail}` : 'operacao invalida');
  }
}
