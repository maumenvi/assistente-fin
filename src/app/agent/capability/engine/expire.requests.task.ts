import { type AfterTurnContext } from '../../after.turn.context.ts';
import { type AfterTurnTask } from '../../after.turn.task.ts';
import { type CapabilityService } from '../capability.service.ts';

/** Depois de cada turno, vence o pedido de capacidade pendente que passou de 24 h (barato; nunca quebra o turno). */
export class ExpireRequestsTask implements AfterTurnTask {
  public readonly name = 'expire-capability-requests';
  private readonly capabilities: CapabilityService;

  public constructor(capabilities: CapabilityService) {
    this.capabilities = capabilities;
  }

  public async run(ctx: AfterTurnContext): Promise<void> {
    await this.capabilities.expire(ctx.userId);
  }
}
