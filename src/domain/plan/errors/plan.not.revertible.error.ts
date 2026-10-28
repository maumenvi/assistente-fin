import { PlanError } from './plan.error.ts';

/** plano nao pode ser desfeito. */
export class PlanNotRevertibleError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_NOT_REVERTIBLE', detail ? `plano nao pode ser desfeito: ${detail}` : 'plano nao pode ser desfeito');
  }
}
