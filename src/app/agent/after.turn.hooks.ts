import { type AfterTurnContext } from './after.turn.context.ts';
import { type AfterTurnTask } from './after.turn.task.ts';
import { type AgentLogPort } from './ports/observe/agent.log.port.ts';

/**
 * Tarefas pos-turno do agente (spec 032, FR-004/FR-017): rodam FORA do caminho da resposta, uma
 * depois da outra, na ordem de registro. Nunca atrasam nem quebram o turno: `schedule` so agenda
 * (adia para depois da resposta), e qualquer erro de tarefa e registrado e ignorado. O fim da sessao
 * de um usuario aborta o que for dele (`cancelUser`), e uma tarefa pendente de quem saiu e descartada.
 */
export class AfterTurnHooks {
  private readonly log: AgentLogPort;
  private readonly tasks: AfterTurnTask[] = [];
  private readonly controllers = new Map<string, AbortController>();
  private readonly pending = new Set<Promise<void>>();

  public constructor(log: AgentLogPort) {
    this.log = log;
  }

  /** Registra uma tarefa; roda depois das registradas antes dela. */
  public register(task: AfterTurnTask): void {
    this.tasks.push(task);
  }

  /** Agenda as tarefas para depois do turno. Retorna na hora e nunca lanca. */
  public schedule(ctx: AfterTurnContext): void {
    if (this.tasks.length === 0) return;
    const signal = this.controllerOf(ctx.userId).signal;
    const job = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => this.runAll(ctx, signal))
      .catch(() => undefined)
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
  }

  /** Fim da sessao do usuario: aborta as tarefas dele (as pendentes se descartam sozinhas). */
  public cancelUser(userId: string): void {
    this.controllers.get(userId)?.abort();
    this.controllers.delete(userId);
  }

  /** Espera as tarefas agendadas terminarem (testes e encerramento do app). */
  public async settled(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  private controllerOf(userId: string): AbortController {
    let controller = this.controllers.get(userId);
    if (controller === undefined || controller.signal.aborted) {
      controller = new AbortController();
      this.controllers.set(userId, controller);
    }
    return controller;
  }

  private async runAll(ctx: AfterTurnContext, signal: AbortSignal): Promise<void> {
    for (const task of this.tasks) {
      if (signal.aborted) return;
      try {
        await task.run(ctx, signal);
      } catch (error) {
        this.log.warn('tarefa pos-turno falhou', { task: task.name, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}
