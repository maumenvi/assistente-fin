import { PlanError } from './plan.error.ts';

/** os dados mudaram desde que o plano foi proposto. */
export class PlanStaleError extends PlanError {
  public constructor(detail?: string) {
    super('PLAN_STALE', detail ? `os dados mudaram desde que o plano foi proposto: ${detail}` : 'os dados mudaram desde que o plano foi proposto');
  }
}
