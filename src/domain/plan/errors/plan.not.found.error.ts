import { PlanError } from './plan.error.ts';

/** plano nao encontrado. */
export class PlanNotFoundError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_NOT_FOUND', detail ? `plano nao encontrado: ${detail}` : 'plano nao encontrado');
  }
}
