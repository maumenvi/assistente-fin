import { type AfterTurnContext } from '../../after.turn.context.ts';
import { type AfterTurnTask } from '../../after.turn.task.ts';
import { type PlanService } from './plan.service.ts';

/** Depois de cada turno, vence o plano pendente que passou da validade (barato; nunca quebra o turno). */
export class ExpirePlansTask implements AfterTurnTask {
  public readonly name = 'expire-plans';

  private readonly plans: PlanService;

  public constructor(plans: PlanService) {
    this.plans = plans;
  }

  public async run(ctx: AfterTurnContext): Promise<void> {
    await this.plans.expire(ctx.userId);
  }
}
